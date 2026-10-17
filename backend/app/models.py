"""Database tables. Relationships:

Organization (= tenant / company) 1──* everything below
User 1──* Lead (assigned_to)         Lead 1──* LeadNote
Project 1──* Building 1──* Unit      Lead 1──* Booking *──1 Unit

MULTI-TENANCY: users, leads, projects, buildings, units and bookings all carry an `org_id`.
Every query in the routers filters on the caller's org_id, so one company can never read or
change another company's rows. (lead_notes are reached only through their lead.)
"""
from datetime import date, datetime, timezone

from sqlalchemy import (Boolean, Date, DateTime, Float, ForeignKey, Index, Integer,
                        String, Text, UniqueConstraint, text)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


def org_fk():
    return mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = org_fk()
    name: Mapped[str] = mapped_column(String(100))
    # Email is unique across ALL companies so login needs only email + password (no company picker).
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="sales")  # "admin" | "sales"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    organization: Mapped[Organization] = relationship()

    @property
    def org_name(self) -> str:
        return self.organization.name


class Lead(Base):
    __tablename__ = "leads"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = org_fk()
    name: Mapped[str] = mapped_column(String(120), index=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)  # unique per company (see __table_args__)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)    # Website, Referral, Walk-in...
    budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    stage: Mapped[str] = mapped_column(String(20), default="New", index=True)
    lost_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    interested_project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    next_follow_up: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)

    assigned_to: Mapped[User | None] = relationship(foreign_keys=[assigned_to_id])
    interested_project: Mapped["Project | None"] = relationship()
    notes: Mapped[list["LeadNote"]] = relationship(back_populates="lead", cascade="all, delete-orphan",
                                                   order_by="LeadNote.id.desc()")

    # The same phone number may exist in two different companies, but only once inside one company.
    __table_args__ = (UniqueConstraint("org_id", "phone", name="uq_lead_phone_per_org"),)


class LeadNote(Base):
    """Timeline entry. kind: note (typed by user) | system (stage change, reassignment, booking...)."""
    __tablename__ = "lead_notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(10), default="note")
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    lead: Mapped[Lead] = relationship(back_populates="notes")
    author: Mapped[User | None] = relationship()


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = org_fk()
    name: Mapped[str] = mapped_column(String(120))
    location: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    buildings: Mapped[list["Building"]] = relationship(back_populates="project", cascade="all, delete-orphan",
                                                       order_by="Building.name")

    __table_args__ = (UniqueConstraint("org_id", "name", name="uq_project_name_per_org"),)


class Building(Base):
    __tablename__ = "buildings"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = org_fk()
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    floors: Mapped[int] = mapped_column(Integer, default=1)
    project: Mapped[Project] = relationship(back_populates="buildings")
    units: Mapped[list["Unit"]] = relationship(back_populates="building", cascade="all, delete-orphan",
                                               order_by="Unit.floor, Unit.unit_number")


class Unit(Base):
    __tablename__ = "units"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = org_fk()
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id", ondelete="CASCADE"), index=True)
    unit_number: Mapped[str] = mapped_column(String(20))
    floor: Mapped[int] = mapped_column(Integer, default=0)
    type: Mapped[str] = mapped_column(String(20))
    area_sqft: Mapped[float] = mapped_column(Float)
    price: Mapped[float] = mapped_column(Float)
    # available | booked | blocked (blocked = admin took it off sale)
    status: Mapped[str] = mapped_column(String(20), default="available", index=True)
    building: Mapped[Building] = relationship(back_populates="units")

    __table_args__ = (Index("uq_unit_number_per_building", "building_id", "unit_number", unique=True),)


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = org_fk()
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"), index=True)
    booked_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    token_amount: Mapped[float] = mapped_column(Float, default=0)
    agreed_price: Mapped[float] = mapped_column(Float)   # snapshot: unit price may change later
    status: Mapped[str] = mapped_column(String(12), default="active")  # active | cancelled
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    lead: Mapped[Lead] = relationship()
    unit: Mapped[Unit] = relationship()
    booked_by: Mapped[User] = relationship()

    # THE safety net against double booking: the database itself refuses a second
    # *active* booking for the same unit, even if two requests race each other.
    __table_args__ = (
        Index("uq_one_active_booking_per_unit", "unit_id", unique=True,
              sqlite_where=text("status = 'active'"), postgresql_where=text("status = 'active'")),
    )
