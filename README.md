# EstateFlow — Real Estate CRM

A small CRM for a real-estate sales team: manage **leads**, browse **properties** (projects → buildings → units) and **book** units without ever double-selling one.

**Live app:** _add your deployed URL here_  ·  

## Try it
- **New company:** click *Create your company workspace* on the login page. You become the Admin of a brand-new, empty, private workspace and can add your sales team from the **Team** page.

Data resets whenever the free host restarts; the demo company and logins are re-created automatically.

## Run locally
```powershell
.\run.ps1          # needs Python 3.11+ and Node 18+: installs deps, builds the React app, starts http://localhost:8000
```
Manual: `python -m venv .venv` → `.venv\Scripts\pip install -r requirements.txt` → `cd frontend; npm install; npm run build` → `cd ..\backend` → `..\.venv\Scripts\python -m uvicorn app.main:app --reload`.
Frontend dev mode (hot reload): run the backend as above, then `cd frontend; npm run dev` and open http://localhost:5173.
Tests (17, incl. tenant isolation and the concurrent-booking race): `cd backend; ..\.venv\Scripts\python -m pytest -q`. They use a throw-away SQLite file, or any database you give via `DATABASE_URL` (also verified on Postgres). Interactive API docs: `http://localhost:8000/api/docs`.

## Features
- **Leads** — create / edit / search (name, phone, email) / filter (stage, follow-up, employee) / paginate; 7 stages; notes timeline; follow-up dates; reassignment (admin).
- **Properties** — projects, buildings, units with type, area, price and availability (available / booked / blocked).
- **Booking flow** — pick a project → pick an available unit → token amount. Cancelling returns the unit to sale.
- **Dashboard** — leads by stage, overdue/today follow-ups, bookings & value this month, inventory, conversion, team leaderboard (admin).
- **Auth, signup & roles** — self-service company signup; Admin vs Sales Employee inside each company (see below). Responsive layout; loading, empty and error states everywhere.


## Important decisions (and why)
1. **Multi-tenant by design: every company is fully isolated.** Signup creates an `organization` and its first Admin. `users, leads, projects, buildings, units, bookings` all carry an `org_id`, and *every* query filters on the caller's company — a row from another company behaves exactly like a row that doesn't exist (404). Cross-references are checked too (you can't assign a lead to, or book a unit from, another company). Uniqueness is per company (the same phone number or project name can exist in two companies) while email is global so login needs no company picker. 9 dedicated tests (and the whole suite, on both SQLite and Postgres) prove the isolation: reading, editing, deleting, assigning, booking and dashboard numbers across two companies.
2. **Double-booking is prevented in the database, not just the UI.** Booking runs `UPDATE units SET status='booked' WHERE id=? AND status='available'` — one atomic statement, so of two simultaneous requests only one changes a row. A partial unique index (`one active booking per unit`) is a second safety net. A test fires 8 parallel requests at one unit and asserts exactly one wins.
3. **"Booked" can only be reached through the booking flow.** Dragging a lead to *Booked* by hand would create a lead marked booked with no unit. Instead stage = Booked is set by the booking, and cancelling the booking sends the lead back to *Negotiation*. Moving a lead to *Lost* requires a reason.
4. **Inside a company, sales staff only see their own leads; admins see all of the company's leads.** Enforced in the API (a foreign lead returns 404, not 403, so it isn't even confirmed to exist). Only admins reassign leads, manage properties/users and see team metrics. Sales employees can cancel only bookings they made.
5. **Data integrity and history.** Duplicate leads are blocked per company by normalised phone number (`+91 98765-43210` = `+919876543210`). Every change (stage, assignment, booking) is written to the lead's activity timeline. A booking snapshots the agreed price, so a later price change doesn't rewrite history, and units/projects with bookings can't be deleted (block them instead).

Stack: **React 18 + Vite**, React Router and TanStack Query on the frontend; **FastAPI + SQLAlchemy** on the backend. One deployable: the Docker build compiles the React app and FastAPI serves it alongside the API. SQLite for zero-setup local dev, Postgres in production via `DATABASE_URL` — the test-suite (including the concurrent-booking test) passes on both.

## Database overview
```
organizations ──< users, leads, projects, buildings, units, bookings   (every table below has org_id)
users ──< leads >── projects        leads ──< lead_notes (timeline)
projects ──< buildings ──< units    leads ──< bookings >── units
```
| Table | Key columns |
|---|---|
| organizations | name — the tenant (company) |
| users | **org_id**, name, email (unique, global), password_hash, role (`admin`/`sales`), is_active |
| leads | **org_id**, name, phone (**unique per org**), email, source, budget, **stage**, lost_reason, assigned_to_id→users, interested_project_id→projects, next_follow_up |
| lead_notes | lead_id, author_id, kind (`note`/`system`), body, created_at (reached only through its lead) |
| projects / buildings | project: **org_id**, name (**unique per org**), location · building: **org_id**, project_id, name, floors |
| units | **org_id**, building_id, unit_number (unique per building), floor, type, area_sqft, price, **status** |
| bookings | **org_id**, lead_id, unit_id, booked_by_id, token_amount, agreed_price, **status** (`active`/`cancelled`), cancel_reason · **unique index on unit_id where status='active'** |



## API overview (all under `/api`, JWT bearer token)
| Method & path | Who | Purpose |
|---|---|---|
| POST `/auth/signup` | public | create a new company + its first admin |
| POST `/auth/login` · GET `/auth/me` | public / all | sign in / current user + company |
| GET `/users` · POST `/users` · PATCH `/users/{id}` | list: all · write: admin | your company's team |
| GET `/leads?q&stage&followup&assigned_to&page` | all (scoped) | search + filter + paginate |
| POST `/leads` · GET/PATCH `/leads/{id}` | all (scoped) | create, view, edit, change stage / assignee |
| POST `/leads/{id}/notes` | all (scoped) | add note, optionally set next follow-up |
| GET `/properties/projects` · `/projects/{id}` | all | projects with unit stats / full tree |
| POST/PATCH/DELETE `/properties/projects…` `/buildings…` `/units…` | admin | manage inventory |
| GET `/bookings?status&lead_id` · POST `/bookings` | all (scoped) | list / book a unit |
| POST `/bookings/{id}/cancel` | admin or booker | cancel with reason |
| GET `/dashboard` | all (scoped) | metrics |

Errors return `{"detail": "human message", "fields": {"phone": "..."}}` with the right status (401 / 403 / 404 / 409 conflict / 422 validation).

## Deploy
A `Dockerfile` and `render.yaml` are included.

## Known limitations / next steps
The free host sleeps when idle (first request takes ~30 s). Signup has no email verification or rate limiting yet, and there's no password reset or invite-link flow (admins create employee accounts). Isolation is enforced in the application layer; Postgres row-level security would be a good extra defence. Schema changes would need a migration tool (Alembic); tables are currently created on start. No email/WhatsApp reminders, audit log UI, or file attachments yet.

