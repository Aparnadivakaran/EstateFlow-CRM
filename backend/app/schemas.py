"""Request/response shapes. Pydantic validates input before our code ever runs."""
import re
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .config import STAGES, UNIT_TYPES

Stage = Literal[tuple(STAGES)]  # type: ignore[valid-type]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth / users ----------
class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(ORM):
    id: int
    name: str
    email: str
    role: str
    is_active: bool


class MeOut(UserOut):
    """The logged-in user, including which company (tenant) they belong to."""
    org_id: int
    org_name: str


class SignupIn(BaseModel):
    company_name: str = Field(min_length=2, max_length=120)
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=100)

    @field_validator("email")
    @classmethod
    def lower(cls, v):
        return v.strip().lower()

    @field_validator("company_name", "name")
    @classmethod
    def strip(cls, v):
        return v.strip()


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=6, max_length=100)
    role: Literal["admin", "sales"] = "sales"

    @field_validator("email")
    @classmethod
    def lower(cls, v):
        return v.strip().lower()


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    role: Literal["admin", "sales"] | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=100)


# ---------- leads ----------
def clean_phone(v: str) -> str:
    v = re.sub(r"[\s\-().]", "", v or "")
    if not re.fullmatch(r"\+?\d{7,15}", v):
        raise ValueError("Enter a valid phone number (7-15 digits)")
    return v


class LeadBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    source: str | None = Field(default=None, max_length=50)
    budget: float | None = Field(default=None, ge=0)
    interested_project_id: int | None = None
    assigned_to_id: int | None = None
    next_follow_up: date | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return clean_phone(v)

    @field_validator("email", "source", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        return v.strip() or None if isinstance(v, str) else v


class LeadCreate(LeadBase):
    stage: Stage = "New"


class LeadUpdate(BaseModel):
    """PATCH semantics: only fields that are sent get changed."""
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = None
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    source: str | None = Field(default=None, max_length=50)
    budget: float | None = Field(default=None, ge=0)
    interested_project_id: int | None = None
    assigned_to_id: int | None = None
    next_follow_up: date | None = None
    stage: Stage | None = None
    lost_reason: str | None = Field(default=None, max_length=255)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return clean_phone(v) if v is not None else v

    @field_validator("email", "source", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        return v.strip() or None if isinstance(v, str) else v


class NoteOut(ORM):
    id: int
    kind: str
    body: str
    created_at: datetime
    author: UserOut | None


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    next_follow_up: date | None = None  # optional: schedule the next follow-up in the same step


class ProjectRef(ORM):
    id: int
    name: str


class LeadOut(ORM):
    id: int
    name: str
    phone: str
    email: str | None
    source: str | None
    budget: float | None
    stage: str
    lost_reason: str | None
    next_follow_up: date | None
    assigned_to_id: int | None
    assigned_to: UserOut | None
    interested_project: ProjectRef | None
    created_at: datetime
    updated_at: datetime


class LeadPage(BaseModel):
    items: list[LeadOut]
    total: int
    page: int
    page_size: int


class LeadDetail(LeadOut):
    notes: list[NoteOut]


# ---------- properties ----------
class ProjectIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    location: str = Field(min_length=2, max_length=150)
    description: str | None = None


class BuildingIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    floors: int = Field(default=1, ge=1, le=200)


class UnitIn(BaseModel):
    unit_number: str = Field(min_length=1, max_length=20)
    floor: int = Field(default=0, ge=0, le=200)
    type: Literal[tuple(UNIT_TYPES)]  # type: ignore[valid-type]
    area_sqft: float = Field(gt=0)
    price: float = Field(gt=0)


class UnitUpdate(BaseModel):
    unit_number: str | None = Field(default=None, min_length=1, max_length=20)
    floor: int | None = Field(default=None, ge=0, le=200)
    type: Literal[tuple(UNIT_TYPES)] | None = None  # type: ignore[valid-type]
    area_sqft: float | None = Field(default=None, gt=0)
    price: float | None = Field(default=None, gt=0)
    status: Literal["available", "blocked"] | None = None  # "booked" is only set by the booking flow


class UnitOut(ORM):
    id: int
    building_id: int
    unit_number: str
    floor: int
    type: str
    area_sqft: float
    price: float
    status: str


class BuildingOut(ORM):
    id: int
    name: str
    floors: int
    units: list[UnitOut]


class ProjectOut(ORM):
    id: int
    name: str
    location: str
    description: str | None
    buildings: list[BuildingOut]


class ProjectSummary(BaseModel):
    id: int
    name: str
    location: str
    description: str | None
    buildings: int
    total_units: int
    available: int
    booked: int
    min_price: float | None
    max_price: float | None


# ---------- bookings ----------
class BookingIn(BaseModel):
    lead_id: int
    unit_id: int
    token_amount: float = Field(default=0, ge=0)
    notes: str | None = Field(default=None, max_length=1000)


class BookingCancel(BaseModel):
    reason: str = Field(min_length=3, max_length=255)


class UnitRef(ORM):
    id: int
    unit_number: str
    type: str


class BookingOut(ORM):
    id: int
    status: str
    token_amount: float
    agreed_price: float
    notes: str | None
    created_at: datetime
    cancelled_at: datetime | None
    cancel_reason: str | None
    lead: "LeadRef"
    unit: UnitRef
    booked_by: UserOut
    project_name: str | None = None
    building_name: str | None = None


class LeadRef(ORM):
    id: int
    name: str
    phone: str


BookingOut.model_rebuild()
