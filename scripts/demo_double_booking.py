"""PoC: several sales users try to book the SAME unit at the SAME instant. Exactly one must win.

Needs the app running (default http://127.0.0.1:8000). Uses only the Python standard library:

    python scripts/demo_double_booking.py
    python scripts/demo_double_booking.py --base https://your-app.onrender.com --racers 8

It logs in as the demo sales users, creates one fresh lead per racer, picks an available unit,
releases all requests together (threading.Barrier) and prints who got what. Afterwards it
cancels the winning booking so the unit is free again (use --keep to leave it booked).
"""
import argparse
import json
import random
import threading
import time
import urllib.error
import urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("--base", default="http://127.0.0.1:8000")
ap.add_argument("--racers", type=int, default=6, help="number of simultaneous booking requests")
ap.add_argument("--keep", action="store_true", help="don't cancel the winning booking afterwards")
args = ap.parse_args()
API = args.base.rstrip("/") + "/api"


def call(method, path, body=None, token=None):
    req = urllib.request.Request(API + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "{}")


def login(email):
    status, data = call("POST", "/auth/login", {"email": email, "password": "password123"})
    assert status == 200, f"login failed for {email}: {data}"
    return data["token"], data["user"]["name"]


# 1. Several different sales employees (the demo company has three; extra racers reuse them)
emails = ["rahul@crm.test", "priya@crm.test", "karthik@crm.test"]
users = [login(emails[i % len(emails)]) for i in range(args.racers)]
admin_token, _ = login("admin@crm.test")

# 2. Pick one available unit
_, projects = call("GET", "/properties/projects", token=admin_token)
unit = None
for p in projects:
    _, full = call("GET", f"/properties/projects/{p['id']}", token=admin_token)
    for b in full["buildings"]:
        for u in b["units"]:
            if u["status"] == "available":
                unit = dict(u, project=p["name"], building=b["name"])
                break
        if unit: break
    if unit: break
assert unit, "no available unit found"
print(f"Target unit: {unit['project']} / {unit['building']} / Unit {unit['unit_number']}  (id {unit['id']}, status: {unit['status']})")

# 3. One brand-new lead per racer, each owned by that racer
tag = random.randint(100000, 999999)
leads = []
for i, (token, name) in enumerate(users):
    status, lead = call("POST", "/leads", {"name": f"Race Lead {i + 1}", "phone": f"9{tag}{i:03d}"}, token)
    assert status == 201, lead
    leads.append(lead["id"])
print(f"Created {len(leads)} leads; firing {len(leads)} booking requests simultaneously...\n")

# 4. Everyone presses "Book" at the same instant
barrier = threading.Barrier(len(users))
results = [None] * len(users)


def racer(i):
    token, _ = users[i]
    barrier.wait()                       # all threads released together
    t0 = time.perf_counter()
    status, body = call("POST", "/bookings", {"lead_id": leads[i], "unit_id": unit["id"], "token_amount": 10000}, token)
    results[i] = (status, body, (time.perf_counter() - t0) * 1000)


threads = [threading.Thread(target=racer, args=(i,)) for i in range(len(users))]
[t.start() for t in threads]
[t.join() for t in threads]

print(f"{'racer':<8}{'user':<16}{'HTTP':<6}{'result':<10}message")
for i, (status, body, ms) in enumerate(results):
    outcome = "BOOKED" if status == 201 else "refused"
    msg = "" if status == 201 else body.get("detail", "")
    print(f"{i + 1:<8}{users[i][1]:<16}{status:<6}{outcome:<10}{msg[:70]}  ({ms:.0f} ms)")

# 5. Verify the end state independently of the responses
winners = [r for r in results if r[0] == 201]
_, bookings = call("GET", "/bookings?status=active", token=admin_token)
active_on_unit = [b for b in bookings if b["unit"]["id"] == unit["id"]]
_, full = call("GET", f"/properties/projects/{next(p['id'] for p in projects if p['name'] == unit['project'])}", token=admin_token)
status_now = next(u["status"] for b in full["buildings"] for u in b["units"] if u["id"] == unit["id"])
print(f"\nSuccessful bookings : {len(winners)}   (expected exactly 1)")
print(f"Active bookings on unit in database: {len(active_on_unit)}   (expected exactly 1)")
print(f"Unit status now     : {status_now}   (expected 'booked')")
ok = len(winners) == 1 and len(active_on_unit) == 1 and status_now == "booked"
print("\nRESULT:", "PASS - the unit was booked exactly once." if ok else "FAIL - double booking detected!")

# 6. Clean up so the demo can be re-run
if winners and not args.keep:
    call("POST", f"/bookings/{winners[0][1]['id']}/cancel", {"reason": "demo cleanup"}, admin_token)
    print("(winning booking cancelled; unit is available again)")
raise SystemExit(0 if ok else 1)
