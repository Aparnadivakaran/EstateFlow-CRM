"""Reusable FastAPI dependencies: who is calling, and are they allowed?"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer),
                 db: Session = Depends(get_db)) -> models.User:
    user_id = decode_token(creds.credentials) if creds else None
    user = db.get(models.User, user_id) if user_id else None
    if not user or not user.is_active:
        raise HTTPException(401, "Not authenticated")
    return user


def admin_only(user: models.User = Depends(current_user)) -> models.User:
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return user


def can_access_lead(user: models.User, lead: models.Lead) -> bool:
    """Tenant check first (a lead from another company is never visible), then role:
    admins see every lead in their company; sales employees only the leads assigned to them."""
    if lead.org_id != user.org_id:
        return False
    return user.role == "admin" or lead.assigned_to_id == user.id
