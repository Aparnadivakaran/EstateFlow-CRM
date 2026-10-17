from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import can_access_lead, current_user
from .leads import system_note

router = APIRouter(prefix="/bookings", tags=["bookings"])


def to_out(b: models.Booking) -> schemas.BookingOut:
    out = schemas.BookingOut.model_validate(b)
    out.building_name = b.unit.building.name
    out.project_name = b.unit.building.project.name
    return out


def _load(db: Session, org_id: int, booking_id: int) -> models.Booking:
    b = db.scalar(select(models.Booking).where(models.Booking.id == booking_id,
                                               models.Booking.org_id == org_id).options(
        joinedload(models.Booking.lead), joinedload(models.Booking.booked_by),
        joinedload(models.Booking.unit).joinedload(models.Unit.building).joinedload(models.Building.project)))
    if not b:
        raise HTTPException(404, "Booking not found")
    return b


@router.get("", response_model=list[schemas.BookingOut])
def list_bookings(status: str | None = None, lead_id: int | None = None, db: Session = Depends(get_db),
                  user: models.User = Depends(current_user)):
    q = select(models.Booking).options(
        joinedload(models.Booking.lead), joinedload(models.Booking.booked_by),
        joinedload(models.Booking.unit).joinedload(models.Unit.building).joinedload(models.Building.project),
    ).where(models.Booking.org_id == user.org_id).order_by(models.Booking.id.desc())
    if user.role != "admin":
        q = q.join(models.Lead).where(or_(models.Booking.booked_by_id == user.id,
                                          models.Lead.assigned_to_id == user.id))
    if lead_id:
        q = q.where(models.Booking.lead_id == lead_id)
    if status in ("active", "cancelled"):
        q = q.where(models.Booking.status == status)
    return [to_out(b) for b in db.scalars(q).unique()]


@router.post("", response_model=schemas.BookingOut, status_code=201)
def create_booking(body: schemas.BookingIn, db: Session = Depends(get_db),
                   user: models.User = Depends(current_user)):
    lead = db.get(models.Lead, body.lead_id)
    if not lead or not can_access_lead(user, lead):
        raise HTTPException(404, "Lead not found")
    if lead.stage == "Lost":
        raise HTTPException(422, "This lead is marked Lost. Reopen it before booking a unit")
    unit = db.get(models.Unit, body.unit_id)
    if not unit or unit.org_id != user.org_id:   # a unit from another company looks like a missing unit
        raise HTTPException(404, "Unit not found")
    if body.token_amount > unit.price:
        raise HTTPException(422, "Token amount can't be more than the unit price")

    taken = HTTPException(409, "Sorry, this unit was just booked or is no longer available. Please pick another unit")

    # Step 1: atomically "claim" the unit. This is a single SQL statement, so when two people
    # click Book at the same moment only ONE of them gets rowcount == 1.
    claimed = db.execute(
        update(models.Unit).where(models.Unit.id == unit.id, models.Unit.status == "available")
        .values(status="booked")
    ).rowcount
    if claimed != 1:
        db.rollback()
        raise taken

    # Step 2: record the booking. The partial unique index is a second line of defence.
    booking = models.Booking(org_id=user.org_id, lead_id=lead.id, unit_id=unit.id, booked_by_id=user.id,
                             token_amount=body.token_amount, agreed_price=unit.price, notes=body.notes)
    db.add(booking)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise taken

    previous = lead.stage
    lead.stage = "Booked"
    lead.lost_reason = None
    lead.next_follow_up = None   # nothing left to chase
    b = _load(db, user.org_id, booking.id)
    system_note(db, lead, user, f"Booked {b.unit.building.project.name} · {b.unit.building.name} · "
                                f"Unit {unit.unit_number} (stage {previous} → Booked)")
    db.commit()
    return to_out(b)


@router.post("/{booking_id}/cancel", response_model=schemas.BookingOut)
def cancel_booking(booking_id: int, body: schemas.BookingCancel, db: Session = Depends(get_db),
                   user: models.User = Depends(current_user)):
    b = _load(db, user.org_id, booking_id)
    if user.role != "admin" and b.booked_by_id != user.id:
        raise HTTPException(403, "Only an admin or the employee who made the booking can cancel it")
    if b.status != "active":
        raise HTTPException(409, "This booking is already cancelled")

    b.status = "cancelled"
    b.cancelled_at = models.now()
    b.cancel_reason = body.reason.strip()
    b.unit.status = "available"   # the unit goes back on sale

    # If the customer has no other active booking, drop the lead back to Negotiation.
    db.flush()
    others = db.scalar(select(func.count(models.Booking.id)).where(
        models.Booking.lead_id == b.lead_id, models.Booking.status == "active"))
    if not others and b.lead.stage == "Booked":
        b.lead.stage = "Negotiation"
    system_note(db, b.lead, user, f"Booking of Unit {b.unit.unit_number} cancelled: {b.cancel_reason}")
    db.commit()
    return to_out(b)
