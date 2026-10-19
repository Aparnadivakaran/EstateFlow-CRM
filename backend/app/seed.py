"""Demo data so the app isn't empty on first run."""
import random
from datetime import date, timedelta

from sqlalchemy import select

from . import models
from .security import hash_password

DEMO_PASSWORD = "password123"


def seed(db):
    """Creates ONE demo company ("Demo Realty"). Skipped if the demo admin already exists.
    New signups get their own empty company; they never see this data."""
    if db.scalar(select(models.User.id).where(models.User.email == "admin@crm.test")):
        return
    random.seed(7)
    org = models.Organization(name="Demo Realty")
    db.add(org)
    db.flush()
    admin = models.User(org_id=org.id, name="Aparna Admin", email="admin@crm.test", role="admin",
                        password_hash=hash_password(DEMO_PASSWORD))
    sales = [models.User(org_id=org.id, name=n, email=e, role="sales", password_hash=hash_password(DEMO_PASSWORD))
             for n, e in [("Rahul Sharma", "rahul@crm.test"), ("Priya Nair", "priya@crm.test"),
                          ("Karthik Iyer", "karthik@crm.test")]]
    db.add_all([admin, *sales])

    projects = []
    spec = [
        ("Skyline Heights", "Whitefield, Bengaluru", "Premium high-rise apartments with clubhouse and pool.",
         [("Tower A", 6, ["2 BHK", "3 BHK"]), ("Tower B", 6, ["1 BHK", "2 BHK"])], 5200),
        ("Green Meadows Villas", "Sarjapur, Bengaluru", "Gated villa community surrounded by greenery.",
         [("Phase 1", 2, ["Villa"])], 6800),
        ("Metro Square", "MG Road, Bengaluru", "Commercial complex with retail and office space.",
         [("Block C", 4, ["Shop", "Office"])], 9500),
    ]
    areas = {"1 BHK": 650, "2 BHK": 1100, "3 BHK": 1550, "Villa": 2400, "Shop": 450, "Office": 900}
    for name, loc, desc, buildings, rate in spec:
        p = models.Project(org_id=org.id, name=name, location=loc, description=desc)
        for bname, floors, types in buildings:
            b = models.Building(org_id=org.id, name=bname, floors=floors)
            for f in range(1, floors + 1):
                for i, t in enumerate(types * 2):  # 4 units per floor for 2 types
                    area = areas[t] + random.choice([0, 20, 40])
                    b.units.append(models.Unit(org_id=org.id, unit_number=f"{f}0{i + 1}", floor=f, type=t, area_sqft=area,
                                               price=round(area * (rate + f * 25), -4)))
            p.buildings.append(b)
        projects.append(p)
    db.add_all(projects)
    db.flush()

    names = ["Anita Desai", "Vikram Singh", "Meera Reddy", "Arjun Kapoor", "Sunita Rao", "Deepak Menon",
             "Kavya Pillai", "Rohit Verma", "Neha Gupta", "Sanjay Patel", "Lakshmi Narayan", "Amit Joshi",
             "Pooja Hegde", "Manoj Kumar", "Divya Shetty", "Suresh Babu", "Ritu Agarwal", "Naveen Gowda"]
    sources = ["Website", "Referral", "Walk-in", "Facebook Ads", "99acres", "Broker"]
    stages = ["New", "New", "Contacted", "Contacted", "Site Visit", "Interested", "Interested", "Negotiation",
              "Negotiation", "Lost"]
    today = date.today()
    now = models.now()
    leads = []
    for i, n in enumerate(names):
        stage = stages[i % len(stages)]
        # spread over ~6 months so the charts have a trend; every third lead is recent so "this month" isn't empty
        created = now - timedelta(days=random.randint(0, 12) if i % 3 == 0 else random.randint(13, 170))
        lead = models.Lead(
            org_id=org.id, name=n, phone=f"98{random.randint(10000000, 99999999)}", source=random.choice(sources),
            email=n.lower().replace(" ", ".") + "@example.com", budget=random.choice([6e6, 8e6, 1.2e7, 2e7, 3e7]),
            stage=stage, assigned_to_id=sales[i % 3].id if i != 5 else None,
            interested_project_id=random.choice(projects).id,
            next_follow_up=None if stage == "Lost" else today + timedelta(days=random.randint(-3, 6)),
            lost_reason="Budget mismatch" if stage == "Lost" else None, created_by_id=admin.id,
            created_at=created, updated_at=created)
        lead.notes.append(models.LeadNote(kind="system", body="Lead created", author_id=admin.id))
        if stage != "New":
            lead.notes.append(models.LeadNote(kind="note", author_id=lead.assigned_to_id or admin.id,
                                              body=random.choice(["Called, asked to call back after 6pm.",
                                                                  "Shared brochure on WhatsApp.",
                                                                  "Interested in higher floors, east facing."])))
        leads.append(lead)
    db.add_all(leads)
    db.flush()

    # Seven demo bookings, back-dated over the last ~6 months, so the Bookings page and the dashboard charts have content
    booked = [(0, 0, 0), (1, 1, 0), (4, 0, 1), (6, 2, 2), (8, 0, 3), (11, 1, 4), (13, 2, 5)]   # (lead idx, project idx, months ago)
    taken = {}
    for lead_idx, proj_idx, months_ago in booked:
        lead = leads[lead_idx]
        units = [u for b in projects[proj_idx].buildings for u in b.units]
        unit = units[taken.get(proj_idx, 0) * 3]          # a different unit each time within a project
        taken[proj_idx] = taken.get(proj_idx, 0) + 1
        unit.status = "booked"
        when = now - timedelta(days=months_ago * 30 + random.randint(0, 6))
        lead.created_at = min(lead.created_at, when - timedelta(days=random.randint(8, 30)))
        lead.stage, lead.next_follow_up, lead.lost_reason = "Booked", None, None
        lead.updated_at = when
        owner_id = lead.assigned_to_id or admin.id
        db.add(models.Booking(org_id=org.id, lead_id=lead.id, unit_id=unit.id, booked_by_id=owner_id,
                              token_amount=round(unit.price * 0.05, -3), agreed_price=unit.price,
                              notes="Token received by cheque", created_at=when))
        db.add(models.LeadNote(lead_id=lead.id, author_id=owner_id, kind="system", created_at=when,
                               body=f"Booked Unit {unit.unit_number} (stage → Booked)"))
    db.commit()
