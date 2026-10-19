import calendar
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..config import STAGES
from ..database import get_db
from ..deps import current_user
from .bookings import to_out

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    L, B, U = models.Lead, models.Booking, models.Unit
    is_admin = user.role == "admin"
    today = date.today()
    open_lead = L.stage.notin_(["Booked", "Lost"])

    def scope_leads(q):
        q = q.where(L.org_id == user.org_id)     # tenant isolation: always, for every role
        return q if is_admin else q.where(L.assigned_to_id == user.id)

    # Leads per stage (always show every stage, even with 0)
    counts = dict(db.execute(scope_leads(select(L.stage, func.count(L.id)).group_by(L.stage))).all())
    by_stage = [{"stage": s, "count": counts.get(s, 0)} for s in STAGES]
    total_leads = sum(counts.values())

    overdue = db.scalar(scope_leads(select(func.count(L.id)).where(L.next_follow_up < today, open_lead)))
    due_today = db.scalar(scope_leads(select(func.count(L.id)).where(L.next_follow_up == today, open_lead)))
    unassigned = db.scalar(select(func.count(L.id)).where(
        L.org_id == user.org_id, L.assigned_to_id.is_(None), open_lead)) if is_admin else 0

    # Follow-up list: overdue first, then today, then the next 7 days
    follow_ups = db.scalars(
        scope_leads(select(L).where(L.next_follow_up <= today + timedelta(days=7), open_lead))
        .options(joinedload(L.assigned_to)).order_by(L.next_follow_up, L.id).limit(8)).all()

    # Bookings
    bq = select(B).where(B.org_id == user.org_id, B.status == "active")
    if not is_admin:
        bq = bq.join(L).where(B.booked_by_id == user.id)
    month_start = datetime(today.year, today.month, 1)
    active = db.scalars(bq.options(
        joinedload(B.lead), joinedload(B.booked_by),
        joinedload(B.unit).joinedload(U.building).joinedload(models.Building.project)
    ).order_by(B.id.desc())).unique().all()
    this_month = [b for b in active if b.created_at >= month_start]

    inventory = dict(db.execute(select(U.status, func.count(U.id)).where(U.org_id == user.org_id)
                                .group_by(U.status)).all())

    leaderboard = []
    if is_admin:
        rows = db.execute(
            select(models.User.id, models.User.name, func.count(B.id), func.coalesce(func.sum(B.agreed_price), 0))
            .join(B, (B.booked_by_id == models.User.id) & (B.status == "active"), isouter=True)
            .where(models.User.org_id == user.org_id, models.User.role == "sales", models.User.is_active.is_(True))
            .group_by(models.User.id).order_by(func.count(B.id).desc())).all()
        leaderboard = [{"id": r[0], "name": r[1], "bookings": r[2], "value": r[3]} for r in rows]

    # Last 8 calendar months (oldest first): booked value / count and new leads, for the charts
    months, y, m = [], today.year, today.month
    for _ in range(8):
        months.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    series = {k: {"month": f"{k[0]}-{k[1]:02d}", "label": calendar.month_abbr[k[1]], "bookings": 0, "value": 0.0, "leads": 0}
              for k in months}
    for b in active:
        s = series.get((b.created_at.year, b.created_at.month))
        if s:
            s["bookings"] += 1
            s["value"] += b.agreed_price
    for (created,) in db.execute(scope_leads(select(L.created_at))).all():
        s = series.get((created.year, created.month))
        if s:
            s["leads"] += 1
    monthly = [series[k] for k in reversed(months)]

    return {
        "scope": "team" if is_admin else "mine",
        "totals": {
            "leads": total_leads,
            "open_leads": total_leads - counts.get("Booked", 0) - counts.get("Lost", 0),
            "overdue_followups": overdue, "followups_today": due_today, "unassigned": unassigned,
            "active_bookings": len(active), "bookings_this_month": len(this_month),
            "sales_value": sum(b.agreed_price for b in active),
            "sales_value_this_month": sum(b.agreed_price for b in this_month),
            "conversion_rate": round(counts.get("Booked", 0) / total_leads * 100, 1) if total_leads else 0,
        },
        "by_stage": by_stage,
        "monthly": monthly,
        "follow_ups": [{"id": l.id, "name": l.name, "phone": l.phone, "stage": l.stage,
                        "next_follow_up": l.next_follow_up,
                        "assigned_to": l.assigned_to.name if l.assigned_to else None} for l in follow_ups],
        "recent_bookings": [to_out(b) for b in active[:5]],
        "inventory": {"available": inventory.get("available", 0), "booked": inventory.get("booked", 0),
                      "blocked": inventory.get("blocked", 0)},
        "leaderboard": leaderboard,
    }
