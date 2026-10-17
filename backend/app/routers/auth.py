from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import admin_only, current_user
from ..security import create_token, hash_password, verify_password

router = APIRouter(tags=["auth & users"])


def _session(user: models.User) -> dict:
    return {"token": create_token(user.id), "user": schemas.MeOut.model_validate(user)}


@router.post("/auth/signup", status_code=201)
def signup(body: schemas.SignupIn, db: Session = Depends(get_db)):
    """Creates a brand-new company (tenant) and its first Admin. Nothing is shared with other companies."""
    if db.scalar(select(models.User.id).where(models.User.email == body.email)):
        raise HTTPException(409, "An account with this email already exists. Try signing in instead")
    org = models.Organization(name=body.company_name)
    db.add(org)
    db.flush()
    user = models.User(org_id=org.id, name=body.name, email=body.email, role="admin",
                       password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:   # two signups with the same email at the same instant
        db.rollback()
        raise HTTPException(409, "An account with this email already exists. Try signing in instead")
    return _session(user)


@router.post("/auth/login")
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(models.User).where(models.User.email == body.email.strip().lower()))
    # Same message for "no such user" and "wrong password" so attackers can't probe for emails.
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(403, "This account has been deactivated. Contact your admin.")
    return _session(user)


@router.get("/auth/me", response_model=schemas.MeOut)
def me(user: models.User = Depends(current_user)):
    return user


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    """Any logged-in user may list THEIR OWN company's team (needed for the 'assign to' dropdown)."""
    return db.scalars(select(models.User).where(models.User.org_id == user.org_id).order_by(models.User.name)).all()


@router.post("/users", response_model=schemas.UserOut, status_code=201)
def create_user(body: schemas.UserCreate, db: Session = Depends(get_db), admin: models.User = Depends(admin_only)):
    if db.scalar(select(models.User.id).where(models.User.email == body.email)):
        raise HTTPException(409, "A user with this email already exists")
    user = models.User(org_id=admin.org_id, name=body.name, email=body.email, role=body.role,
                       password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A user with this email already exists")
    return user


@router.patch("/users/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, body: schemas.UserUpdate, db: Session = Depends(get_db),
                admin: models.User = Depends(admin_only)):
    user = db.scalar(select(models.User).where(models.User.id == user_id, models.User.org_id == admin.org_id))
    if not user:
        raise HTTPException(404, "User not found")
    data = body.model_dump(exclude_unset=True)
    # Guard rail: an admin can't lock themselves out.
    if user.id == admin.id and (data.get("is_active") is False or data.get("role") == "sales"):
        raise HTTPException(400, "You can't deactivate or demote your own account")
    if "password" in data:
        user.password_hash = hash_password(data.pop("password"))
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    return user
