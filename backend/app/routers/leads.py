from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..config import STAGES
from ..database import get_db
from ..deps import can_access_lead, current_user

router = APIRouter(prefix="/leads", tags=["leads"])


def system_note(db: Session, lead: models.Lead, user: models.User | None, text: str):
    db.add(models.LeadNote(lead_id=lead.id, author_id=user.id if user else None, kind="system", body=text))


def get_lead_or_404(db: Session, user: models.User, lead_id: int) -> models.Lead:
    lead = db.get(models.Lead, lead_id)
    # 404 (not 403) for other people's leads: don't even confirm that the lead exists.
    if not lead or not can_access_lead(user, lead):
        raise HTTPException(404, "Lead not found")
    return lead


def check_refs(db: Session, org_id: int, project_id, assignee_id):
    """Projects and employees referenced by a lead must belong to the SAME company."""
    if project_id is not None:
        p = db.get(models.Project, project_id)
        if not p or p.org_id != org_id:
            raise HTTPException(422, "Selected project does not exist")
    if assignee_id is not None:
        u = db.get(models.User, assignee_id)
        if not u or u.org_id != org_id or not u.is_active:
            raise HTTPException(422, "Selected employee does not exist or is inactive")


def duplicate_error(db: Session, org_id: int, phone: str, exclude_id: int | None = None):
    q = select(models.Lead).where(models.Lead.org_id == org_id, models.Lead.phone == phone)
    if exclude_id:
        q = q.where(models.Lead.id != exclude_id)
    existing = db.scalar(q)
    if existing:
        # Don't leak who owns it to a salesperson who can't see it; admins get the id.
        raise HTTPException(409, f"A lead with this phone number already exists ({existing.name})")


@router.get("", response_model=schemas.LeadPage)
def list_leads(
    q: str | None = None,
    stage: str | None = None,
    assigned_to: int | None = None,
    followup: str | None = Query(default=None, pattern="^(today|overdue|upcoming|none)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=15, ge=1, le=100),
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
):
    L = models.Lead
    query = select(L).where(L.org_id == user.org_id)
    if user.role != "admin":
        query = query.where(L.assigned_to_id == user.id)
    elif assigned_to is not None:
        query = query.where(L.assigned_to_id == (None if assigned_to == 0 else assigned_to))  # 0 = unassigned
    if q:
        like = f"%{q.strip()}%"
        query = query.where(or_(L.name.ilike(like), L.phone.ilike(like), L.email.ilike(like)))
    if stage:
        if stage not in STAGES:
            raise HTTPException(422, "Unknown stage")
        query = query.where(L.stage == stage)
    today = date.today()
    open_lead = L.stage.notin_(["Booked", "Lost"])
    if followup == "today":
        query = query.where(L.next_follow_up == today, open_lead)
    elif followup == "overdue":
        query = query.where(L.next_follow_up < today, open_lead)
    elif followup == "upcoming":
        query = query.where(L.next_follow_up > today, open_lead)
    elif followup == "none":
        query = query.where(L.next_follow_up.is_(None), open_lead)

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.options(selectinload(L.assigned_to), selectinload(L.interested_project))
        .order_by(L.updated_at.desc(), L.id.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=schemas.LeadDetail, status_code=201)
def create_lead(body: schemas.LeadCreate, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    data = body.model_dump()
    if data["stage"] == "Booked":
        raise HTTPException(422, "A lead becomes 'Booked' only through the booking flow")
    if user.role != "admin":
        data["assigned_to_id"] = user.id  # sales employees own the leads they create
    check_refs(db, user.org_id, data["interested_project_id"], data["assigned_to_id"])
    duplicate_error(db, user.org_id, data["phone"])
    lead = models.Lead(**data, org_id=user.org_id, created_by_id=user.id)
    db.add(lead)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A lead with this phone number already exists")
    system_note(db, lead, user, "Lead created")
    db.commit()
    return lead


@router.get("/{lead_id}", response_model=schemas.LeadDetail)
def get_lead(lead_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    return get_lead_or_404(db, user, lead_id)


@router.patch("/{lead_id}", response_model=schemas.LeadDetail)
def update_lead(lead_id: int, body: schemas.LeadUpdate, db: Session = Depends(get_db),
                user: models.User = Depends(current_user)):
    lead = get_lead_or_404(db, user, lead_id)
    data = body.model_dump(exclude_unset=True)

    if "assigned_to_id" in data and data["assigned_to_id"] != lead.assigned_to_id and user.role != "admin":
        raise HTTPException(403, "Only an admin can reassign leads")
    check_refs(db, user.org_id, data.get("interested_project_id"), data.get("assigned_to_id"))
    if "phone" in data and data["phone"] != lead.phone:
        duplicate_error(db, user.org_id, data["phone"], lead.id)

    new_stage = data.get("stage")
    if new_stage and new_stage != lead.stage:
        if new_stage == "Booked":
            raise HTTPException(422, "A lead becomes 'Booked' only through the booking flow")
        if lead.stage == "Booked":
            raise HTTPException(422, "This lead has an active booking. Cancel the booking first to change the stage")
        if new_stage == "Lost" and not (data.get("lost_reason") or lead.lost_reason):
            raise HTTPException(422, "Please give a reason for marking the lead as Lost")
        system_note(db, lead, user, f"Stage changed: {lead.stage} → {new_stage}"
                    + (f" ({data['lost_reason']})" if new_stage == "Lost" else ""))
        if new_stage != "Lost":
            data["lost_reason"] = None  # reopening a lost lead clears the reason
    elif "stage" in data and new_stage == lead.stage:
        data.pop("stage")

    if "assigned_to_id" in data and data["assigned_to_id"] != lead.assigned_to_id:
        assignee = db.get(models.User, data["assigned_to_id"]) if data["assigned_to_id"] else None
        system_note(db, lead, user, f"Assigned to {assignee.name if assignee else 'nobody'}")

    for k, v in data.items():
        setattr(lead, k, v)
    db.commit()
    return lead


@router.post("/{lead_id}/notes", response_model=schemas.LeadDetail, status_code=201)
def add_note(lead_id: int, body: schemas.NoteIn, db: Session = Depends(get_db),
             user: models.User = Depends(current_user)):
    lead = get_lead_or_404(db, user, lead_id)
    db.add(models.LeadNote(lead_id=lead.id, author_id=user.id, kind="note", body=body.body.strip()))
    if body.next_follow_up:
        lead.next_follow_up = body.next_follow_up
        system_note(db, lead, user, f"Follow-up scheduled for {body.next_follow_up.strftime('%d %b %Y')}")
    db.commit()
    db.refresh(lead)
    return lead
