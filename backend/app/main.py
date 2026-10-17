"""App entry point: wires routers together and serves the frontend files."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import models
from .config import FRONTEND_DIR, SEED_DEMO, STAGES, UNIT_TYPES
from .database import Base, SessionLocal, engine
from .routers import auth, bookings, dashboard, leads, properties
from .seed import seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)  # creates tables if they don't exist yet
    if SEED_DEMO:
        with SessionLocal() as db:
            seed(db)
    yield


app = FastAPI(title="Real Estate CRM", lifespan=lifespan)
api = FastAPI(title="Real Estate CRM API")  # mounted under /api so API routes never clash with frontend files


@api.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    """Turn Pydantic's verbose errors into {detail: "...", fields: {field: message}} for the UI."""
    fields = {}
    for e in exc.errors():
        field = str(e["loc"][-1]) if e["loc"] else "body"
        fields.setdefault(field, e["msg"].replace("Value error, ", ""))
    first = next(iter(fields.items()), ("", "Invalid input"))
    return JSONResponse(status_code=422, content={"detail": f"{first[0]}: {first[1]}" if first[0] else first[1],
                                                  "fields": fields})


for r in (auth.router, leads.router, properties.router, bookings.router, dashboard.router):
    api.include_router(r)


@api.get("/meta")
def meta():
    return {"stages": STAGES, "unit_types": UNIT_TYPES}


@api.get("/health")
def health():
    return {"ok": True}


app.mount("/api", api)
if (FRONTEND_DIR / "assets").is_dir():   # absent until the frontend has been built
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def spa(path: str):
    """Serve a built file if it exists, otherwise index.html (React Router handles the URL in the browser)."""
    index = FRONTEND_DIR / "index.html"
    if not index.exists():
        raise HTTPException(503, "Frontend not built yet. Run: cd frontend && npm install && npm run build")
    candidate = (FRONTEND_DIR / path).resolve()
    if path and candidate.is_file() and FRONTEND_DIR.resolve() in candidate.parents:
        return FileResponse(candidate)
    return FileResponse(index)
