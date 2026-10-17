"""Settings read from environment variables, with safe defaults for local dev."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent          # .../backend
ROOT_DIR = BASE_DIR.parent                                  # project root
FRONTEND_DIR = ROOT_DIR / "frontend" / "dist"               # output of `npm run build` (Vite)

# On a host with a persistent disk, point DATABASE_URL at it (see README).
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'crm.db'}")
# Hosts like Neon/Heroku hand out "postgres://..." but SQLAlchemy wants "postgresql://...".
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-secret-change-me-in-production-0000")
TOKEN_HOURS = int(os.getenv("TOKEN_HOURS", "12"))
# Seed demo data on first start when the database is empty.
SEED_DEMO = os.getenv("SEED_DEMO", "1") == "1"

STAGES = ["New", "Contacted", "Site Visit", "Interested", "Negotiation", "Booked", "Lost"]
UNIT_TYPES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Villa", "Plot", "Shop", "Office"]
