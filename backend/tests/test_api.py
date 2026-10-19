"""Run with:  cd backend && ..\\.venv\\Scripts\\python -m pytest -q"""
import os
import tempfile
import threading
from datetime import date

# Must be set before importing the app. Pass your own DATABASE_URL to run the suite against Postgres.
os.environ.setdefault("DATABASE_URL", f"sqlite:///{tempfile.mkdtemp()}/test.db")
os.environ["SEED_DEMO"] = "1"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email, password="password123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin(client):
    return login(client, "admin@crm.test")


@pytest.fixture(scope="module")
def rahul(client):
    return login(client, "rahul@crm.test")


@pytest.fixture(scope="module")
def priya(client):
    return login(client, "priya@crm.test")


def test_login_and_auth_required(client):
    assert client.get("/api/leads").status_code == 401
    assert client.post("/api/auth/login", json={"email": "admin@crm.test", "password": "nope"}).status_code == 401


def test_sales_only_sees_own_leads(client, admin, rahul):
    mine = client.get("/api/leads?page_size=100", headers=rahul).json()
    assert mine["total"] > 0
    me = client.get("/api/auth/me", headers=rahul).json()["id"]
    assert all(l["assigned_to_id"] == me for l in mine["items"])
    everyone = client.get("/api/leads?page_size=100", headers=admin).json()
    assert everyone["total"] > mine["total"]
    other = next(l for l in everyone["items"] if l["assigned_to_id"] not in (me, None))
    assert client.get(f"/api/leads/{other['id']}", headers=rahul).status_code == 404


def test_lead_validation_and_duplicates(client, rahul):
    bad = client.post("/api/leads", headers=rahul, json={"name": "X", "phone": "abc"})
    assert bad.status_code == 422 and "fields" in bad.json()
    ok = client.post("/api/leads", headers=rahul, json={"name": "Test Person", "phone": "+91 99999-11111"})
    assert ok.status_code == 201 and ok.json()["phone"] == "+919999911111"
    dup = client.post("/api/leads", headers=rahul, json={"name": "Dup", "phone": "+919999911111"})
    assert dup.status_code == 409


def test_stage_rules(client, rahul):
    lead = client.post("/api/leads", headers=rahul, json={"name": "Stage Tester", "phone": "9000000001"}).json()
    url = f"/api/leads/{lead['id']}"
    assert client.patch(url, headers=rahul, json={"stage": "Booked"}).status_code == 422
    assert client.patch(url, headers=rahul, json={"stage": "Lost"}).status_code == 422   # needs a reason
    r = client.patch(url, headers=rahul, json={"stage": "Lost", "lost_reason": "Not interested"})
    assert r.status_code == 200 and r.json()["stage"] == "Lost"
    r = client.patch(url, headers=rahul, json={"stage": "Contacted"})
    assert r.json()["lost_reason"] is None
    assert any("Stage changed" in n["body"] for n in r.json()["notes"])


def test_only_admin_reassigns_and_manages_properties(client, admin, rahul):
    lead = client.post("/api/leads", headers=rahul, json={"name": "Owner Test", "phone": "9000000002"}).json()
    assert client.patch(f"/api/leads/{lead['id']}", headers=rahul, json={"assigned_to_id": 1}).status_code == 403
    assert client.post("/api/properties/projects", headers=rahul,
                       json={"name": "Hack", "location": "Nowhere"}).status_code == 403
    assert client.post("/api/properties/projects", headers=admin,
                       json={"name": "New Project", "location": "Mysuru"}).status_code == 201


def _available_unit(client, admin):
    p = client.get("/api/properties/projects/1", headers=admin).json()
    return next(u for b in p["buildings"] for u in b["units"] if u["status"] == "available")


def test_booking_flow_and_cancel(client, admin, rahul):
    unit = _available_unit(client, admin)
    lead = client.post("/api/leads", headers=rahul, json={"name": "Buyer One", "phone": "9000000003"}).json()
    r = client.post("/api/bookings", headers=rahul, json={"lead_id": lead["id"], "unit_id": unit["id"], "token_amount": 50000})
    assert r.status_code == 201, r.text
    bid = r.json()["id"]
    assert client.get(f"/api/leads/{lead['id']}", headers=rahul).json()["stage"] == "Booked"
    # same unit again -> refused
    other = client.post("/api/leads", headers=rahul, json={"name": "Buyer Two", "phone": "9000000004"}).json()
    again = client.post("/api/bookings", headers=rahul, json={"lead_id": other["id"], "unit_id": unit["id"]})
    assert again.status_code == 409
    # cancel -> unit free, lead back to Negotiation
    assert client.post(f"/api/bookings/{bid}/cancel", headers=rahul, json={"reason": "Changed mind"}).status_code == 200
    assert client.get(f"/api/leads/{lead['id']}", headers=rahul).json()["stage"] == "Negotiation"
    again = client.post("/api/bookings", headers=rahul, json={"lead_id": other["id"], "unit_id": unit["id"]})
    assert again.status_code == 201


def test_concurrent_booking_only_one_wins(client, admin, rahul, priya):
    """Many simultaneous requests for one unit: exactly one 201, everyone else 409."""
    p = client.get("/api/properties/projects/1", headers=admin).json()
    unit = [u for b in p["buildings"] for u in b["units"] if u["status"] == "available"][3]
    leads = [client.post("/api/leads", headers=rahul, json={"name": f"Racer {i}", "phone": f"91000000{i:02d}"}).json()
             for i in range(8)]
    results = []

    def go(lead):
        r = client.post("/api/bookings", headers=rahul, json={"lead_id": lead["id"], "unit_id": unit["id"]})
        results.append(r.status_code)

    threads = [threading.Thread(target=go, args=(l,)) for l in leads]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sorted(results).count(201) == 1, results
    assert results.count(409) == 7, results


def test_dashboard(client, admin, rahul):
    d = client.get("/api/dashboard", headers=admin).json()
    assert d["scope"] == "team" and len(d["by_stage"]) == 7 and d["leaderboard"]
    assert len(d["monthly"]) == 8 and d["monthly"][-1]["month"] == date.today().strftime("%Y-%m")
    assert sum(m["bookings"] for m in d["monthly"]) >= 5          # demo bookings are spread over the last months
    d2 = client.get("/api/dashboard", headers=rahul).json()
    assert d2["scope"] == "mine" and d2["leaderboard"] == []


# ======================= signup + multi-tenant isolation =======================
def signup(client, company, email, name="Owner", password="longpassword1"):
    r = client.post("/api/auth/signup", json={"company_name": company, "name": name, "email": email, "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]


@pytest.fixture(scope="module")
def tenants(client):
    """Two brand-new companies, each with an admin, a project/unit and a lead."""
    out = {}
    for key, company in (("a", "Acme Realty"), ("b", "Beta Homes")):
        admin, me = signup(client, company, f"owner-{key}@example.com")
        proj = client.post("/api/properties/projects", headers=admin, json={"name": "Shared Name", "location": "Pune"}).json()
        bld = client.post(f"/api/properties/projects/{proj['id']}/buildings", headers=admin, json={"name": "T1", "floors": 3}).json()
        unit = client.post(f"/api/properties/buildings/{bld['id']}/units", headers=admin,
                           json={"unit_number": "101", "floor": 1, "type": "2 BHK", "area_sqft": 1000, "price": 5000000}).json()
        lead = client.post("/api/leads", headers=admin, json={"name": f"Lead {key}", "phone": "9000011111"}).json()
        out[key] = dict(admin=admin, me=me, project=proj, building=bld, unit=unit, lead=lead)
    return out


def test_signup_creates_isolated_empty_company(client):
    h, me = signup(client, "Fresh Co", "fresh@example.com")
    assert me["role"] == "admin" and me["org_name"] == "Fresh Co"
    assert client.get("/api/leads", headers=h).json()["total"] == 0
    assert client.get("/api/properties/projects", headers=h).json() == []
    assert len(client.get("/api/users", headers=h).json()) == 1
    d = client.get("/api/dashboard", headers=h).json()
    assert d["totals"]["leads"] == 0 and d["inventory"] == {"available": 0, "booked": 0, "blocked": 0}


def test_signup_validation_and_duplicates(client):
    bad = client.post("/api/auth/signup", json={"company_name": "X", "name": "A", "email": "nope", "password": "short"})
    assert bad.status_code == 422 and "fields" in bad.json()
    signup(client, "Dup Co", "dup@example.com")
    again = client.post("/api/auth/signup", json={"company_name": "Other", "name": "Someone", "email": "DUP@example.com",
                                                  "password": "longpassword1"})
    assert again.status_code == 409
    # email is global across companies: an existing demo user can't be re-registered either
    assert client.post("/api/users", headers=login(client, "admin@crm.test"),
                       json={"name": "Dup", "email": "dup@example.com", "password": "secret123"}).status_code == 409
    assert login(client, "dup@example.com", "longpassword1")


def test_same_phone_and_project_name_allowed_across_companies(tenants):
    # fixture already created identical phone / project names in both companies without a 409
    assert tenants["a"]["lead"]["phone"] == tenants["b"]["lead"]["phone"]
    assert tenants["a"]["project"]["name"] == tenants["b"]["project"]["name"]


def test_cannot_read_other_tenants_data(client, tenants):
    a, b = tenants["a"], tenants["b"]
    h = a["admin"]
    assert client.get(f"/api/leads/{b['lead']['id']}", headers=h).status_code == 404
    assert client.get(f"/api/properties/projects/{b['project']['id']}", headers=h).status_code == 404
    assert [l["id"] for l in client.get("/api/leads", headers=h).json()["items"]] == [a["lead"]["id"]]
    assert [p["id"] for p in client.get("/api/properties/projects", headers=h).json()] == [a["project"]["id"]]
    assert [u["id"] for u in client.get("/api/users", headers=h).json()] == [a["me"]["id"]]


def test_cannot_modify_other_tenants_data(client, tenants):
    a, b = tenants["a"], tenants["b"]
    h = a["admin"]
    assert client.patch(f"/api/leads/{b['lead']['id']}", headers=h, json={"name": "Hacked"}).status_code == 404
    assert client.post(f"/api/leads/{b['lead']['id']}/notes", headers=h, json={"body": "x"}).status_code == 404
    assert client.patch(f"/api/properties/units/{b['unit']['id']}", headers=h, json={"status": "blocked"}).status_code == 404
    assert client.delete(f"/api/properties/units/{b['unit']['id']}", headers=h).status_code == 404
    assert client.patch(f"/api/properties/projects/{b['project']['id']}", headers=h,
                        json={"name": "Hacked", "location": "Elsewhere"}).status_code == 404
    assert client.delete(f"/api/properties/projects/{b['project']['id']}", headers=h).status_code == 404
    assert client.post(f"/api/properties/projects/{b['project']['id']}/buildings", headers=h,
                       json={"name": "T9", "floors": 1}).status_code == 404
    assert client.post(f"/api/properties/buildings/{b['building']['id']}/units", headers=h,
                       json={"unit_number": "999", "floor": 1, "type": "2 BHK", "area_sqft": 900, "price": 4000000}).status_code == 404
    assert client.patch(f"/api/users/{b['me']['id']}", headers=h, json={"is_active": False}).status_code == 404
    # B's data is untouched
    assert client.get(f"/api/leads/{b['lead']['id']}", headers=b["admin"]).json()["name"] == "Lead b"


def test_cannot_reference_other_tenants_rows(client, tenants):
    a, b = tenants["a"], tenants["b"]
    h = a["admin"]
    # assign own lead to another company's employee / link another company's project
    assert client.patch(f"/api/leads/{a['lead']['id']}", headers=h, json={"assigned_to_id": b["me"]["id"]}).status_code == 422
    assert client.patch(f"/api/leads/{a['lead']['id']}", headers=h,
                        json={"interested_project_id": b["project"]["id"]}).status_code == 422
    assert client.post("/api/leads", headers=h, json={"name": "Nope", "phone": "9000022222",
                                                       "assigned_to_id": b["me"]["id"]}).status_code == 422


def test_booking_isolation(client, tenants):
    a, b = tenants["a"], tenants["b"]
    # A tries to book B's unit (with A's own lead) and B's lead
    assert client.post("/api/bookings", headers=a["admin"], json={"lead_id": a["lead"]["id"], "unit_id": b["unit"]["id"]}).status_code == 404
    assert client.post("/api/bookings", headers=a["admin"], json={"lead_id": b["lead"]["id"], "unit_id": a["unit"]["id"]}).status_code == 404
    # B books its own unit; A can neither see nor cancel that booking
    ok = client.post("/api/bookings", headers=b["admin"], json={"lead_id": b["lead"]["id"], "unit_id": b["unit"]["id"]})
    assert ok.status_code == 201
    bid = ok.json()["id"]
    assert client.get("/api/bookings", headers=a["admin"]).json() == []
    assert client.post(f"/api/bookings/{bid}/cancel", headers=a["admin"], json={"reason": "just because"}).status_code == 404
    assert client.get("/api/bookings", headers=b["admin"]).json()[0]["id"] == bid


def test_dashboard_and_inventory_are_per_company(client, tenants):
    a, b = tenants["a"], tenants["b"]
    da = client.get("/api/dashboard", headers=a["admin"]).json()
    db_ = client.get("/api/dashboard", headers=b["admin"]).json()
    assert da["totals"]["leads"] == 1 and da["inventory"]["booked"] == 0 and da["totals"]["active_bookings"] == 0
    assert db_["inventory"]["booked"] == 1 and db_["totals"]["active_bookings"] == 1
    demo = client.get("/api/dashboard", headers=login(client, "admin@crm.test")).json()
    assert demo["totals"]["leads"] > 1 and demo["totals"]["leads"] != da["totals"]["leads"]


def test_new_company_employees_stay_inside_their_company(client, tenants):
    a = tenants["a"]
    r = client.post("/api/users", headers=a["admin"], json={"name": "Sales Sam", "email": "sam-a@example.com", "password": "secret123"})
    assert r.status_code == 201
    sam = login(client, "sam-a@example.com", "secret123")
    assert client.get("/api/auth/me", headers=sam).json()["org_name"] == "Acme Realty"
    assert client.get("/api/leads", headers=sam).json()["total"] == 0          # nothing assigned to Sam yet
    assert client.get(f"/api/leads/{tenants['b']['lead']['id']}", headers=sam).status_code == 404
    assert client.get("/api/properties/projects", headers=sam).json()[0]["id"] == a["project"]["id"]
    assert len(client.get("/api/users", headers=sam).json()) == 2
