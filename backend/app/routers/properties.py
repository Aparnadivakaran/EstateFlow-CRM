from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..deps import admin_only, current_user

router = APIRouter(prefix="/properties", tags=["properties"])


# Every lookup below filters on org_id: another company's id behaves exactly like a missing id (404).
def _project_or_404(db: Session, user: models.User, project_id: int) -> models.Project:
    p = db.scalar(select(models.Project)
                  .where(models.Project.id == project_id, models.Project.org_id == user.org_id)
                  .options(selectinload(models.Project.buildings).selectinload(models.Building.units)))
    if not p:
        raise HTTPException(404, "Project not found")
    return p


def _building_or_404(db: Session, user: models.User, building_id: int) -> models.Building:
    b = db.scalar(select(models.Building).where(models.Building.id == building_id,
                                                models.Building.org_id == user.org_id))
    if not b:
        raise HTTPException(404, "Building not found")
    return b


def _unit_or_404(db: Session, user: models.User, unit_id: int) -> models.Unit:
    u = db.scalar(select(models.Unit).where(models.Unit.id == unit_id, models.Unit.org_id == user.org_id))
    if not u:
        raise HTTPException(404, "Unit not found")
    return u


@router.get("/projects", response_model=list[schemas.ProjectSummary])
def list_projects(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    out = []
    for p in db.scalars(select(models.Project).where(models.Project.org_id == user.org_id)
                        .order_by(models.Project.name)):
        stats = db.execute(
            select(func.count(models.Unit.id),
                   func.sum(case((models.Unit.status == "available", 1), else_=0)),
                   func.sum(case((models.Unit.status == "booked", 1), else_=0)),
                   func.min(models.Unit.price), func.max(models.Unit.price))
            .join(models.Building).where(models.Building.project_id == p.id, models.Unit.org_id == user.org_id)
        ).one()
        out.append(schemas.ProjectSummary(
            id=p.id, name=p.name, location=p.location, description=p.description,
            buildings=len(p.buildings), total_units=stats[0], available=stats[1] or 0,
            booked=stats[2] or 0, min_price=stats[3], max_price=stats[4]))
    return out


@router.get("/projects/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    return _project_or_404(db, user, project_id)


@router.post("/projects", response_model=schemas.ProjectOut, status_code=201)
def create_project(body: schemas.ProjectIn, db: Session = Depends(get_db), admin: models.User = Depends(admin_only)):
    if db.scalar(select(models.Project.id).where(models.Project.org_id == admin.org_id,
                                                 func.lower(models.Project.name) == body.name.strip().lower())):
        raise HTTPException(409, "A project with this name already exists")
    p = models.Project(org_id=admin.org_id, **body.model_dump())
    db.add(p)
    db.commit()
    return _project_or_404(db, admin, p.id)


@router.patch("/projects/{project_id}", response_model=schemas.ProjectOut)
def update_project(project_id: int, body: schemas.ProjectIn, db: Session = Depends(get_db),
                   admin: models.User = Depends(admin_only)):
    p = _project_or_404(db, admin, project_id)
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A project with this name already exists")
    return p


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), admin: models.User = Depends(admin_only)):
    p = _project_or_404(db, admin, project_id)
    booked = db.scalar(select(func.count(models.Booking.id)).join(models.Unit).join(models.Building)
                       .where(models.Building.project_id == p.id))
    if booked:
        raise HTTPException(409, "This project has bookings on record and can't be deleted")
    db.delete(p)
    db.commit()


@router.post("/projects/{project_id}/buildings", response_model=schemas.BuildingOut, status_code=201)
def create_building(project_id: int, body: schemas.BuildingIn, db: Session = Depends(get_db),
                    admin: models.User = Depends(admin_only)):
    p = _project_or_404(db, admin, project_id)
    if any(b.name.lower() == body.name.strip().lower() for b in p.buildings):
        raise HTTPException(409, "This project already has a building with that name")
    b = models.Building(org_id=admin.org_id, project_id=p.id, **body.model_dump())
    db.add(b)
    db.commit()
    return b


@router.post("/buildings/{building_id}/units", response_model=schemas.UnitOut, status_code=201)
def create_unit(building_id: int, body: schemas.UnitIn, db: Session = Depends(get_db),
                admin: models.User = Depends(admin_only)):
    b = _building_or_404(db, admin, building_id)
    if body.floor > b.floors:
        raise HTTPException(422, f"This building only has {b.floors} floors")
    u = models.Unit(org_id=admin.org_id, building_id=b.id, **body.model_dump())
    db.add(u)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"Unit {body.unit_number} already exists in this building")
    return u


@router.patch("/units/{unit_id}", response_model=schemas.UnitOut)
def update_unit(unit_id: int, body: schemas.UnitUpdate, db: Session = Depends(get_db),
                admin: models.User = Depends(admin_only)):
    u = _unit_or_404(db, admin, unit_id)
    data = body.model_dump(exclude_unset=True)
    if u.status == "booked" and data.get("status"):
        raise HTTPException(409, "This unit is booked. Cancel the booking to change its availability")
    for k, v in data.items():
        setattr(u, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "That unit number already exists in this building")
    return u


@router.delete("/units/{unit_id}", status_code=204)
def delete_unit(unit_id: int, db: Session = Depends(get_db), admin: models.User = Depends(admin_only)):
    u = _unit_or_404(db, admin, unit_id)
    if db.scalar(select(func.count(models.Booking.id)).where(models.Booking.unit_id == u.id)):
        raise HTTPException(409, "This unit has booking history and can't be deleted. Block it instead")
    db.delete(u)
    db.commit()
