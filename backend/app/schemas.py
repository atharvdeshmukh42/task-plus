import re
from datetime import date, datetime, time
from functools import cache
from typing import Literal
from zoneinfo import available_timezones

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models import AccessLevel, Recurrence
from app.scheduling import Scope, Status

PHONE_PATTERN = re.compile(r"^\+?[0-9]{6,15}$")


@cache
def _timezones() -> frozenset[str]:
    return frozenset(available_timezones())


def normalize_phone(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"[\s\-().]", "", value)
    if not cleaned:
        return None
    if not PHONE_PATTERN.match(cleaned):
        raise ValueError("Enter a phone number with 6 to 15 digits, optionally starting with +.")
    return cleaned


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _validate_timezone(value: str) -> str:
    if value not in _timezones():
        raise ValueError("Choose a timezone from the list, for example Asia/Kolkata.")
    return value


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Organizations and people ----------


class OrganizationOut(Schema):
    id: int
    name: str
    timezone: str


class RoleRef(Schema):
    id: int
    name: str


class UserOut(Schema):
    id: int
    full_name: str
    email: str | None
    phone: str | None
    access_level: AccessLevel
    is_active: bool
    roles: list[RoleRef]
    created_at: datetime


class SessionOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    organization: OrganizationOut


class MeOut(BaseModel):
    user: UserOut
    organization: OrganizationOut


class SignupIn(BaseModel):
    organization_name: str = Field(min_length=1, max_length=120)
    timezone: str = "UTC"
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    _tz = field_validator("timezone")(_validate_timezone)

    @field_validator("organization_name", "full_name")
    @classmethod
    def strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required.")
        return value


class LoginIn(BaseModel):
    identifier: str = Field(min_length=1, description="Email address or phone number")
    password: str = Field(min_length=1)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    timezone: str | None = None

    @field_validator("timezone")
    @classmethod
    def tz(cls, value: str | None) -> str | None:
        return None if value is None else _validate_timezone(value)


class MemberCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = None
    password: str = Field(min_length=8, max_length=128)
    access_level: Literal["employee", "supervisor"] = "employee"
    role_ids: list[int] = []

    @field_validator("email", mode="before")
    @classmethod
    def blank_email(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @field_validator("phone")
    @classmethod
    def phone_format(cls, value: str | None) -> str | None:
        return normalize_phone(value)

    @model_validator(mode="after")
    def needs_contact(self) -> "MemberCreate":
        self.full_name = self.full_name.strip()
        if not self.email and not self.phone:
            raise ValueError("Add an email address or a phone number so this person can sign in.")
        return self


class MemberUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    access_level: Literal["employee", "supervisor"] | None = None
    role_ids: list[int] | None = None
    is_active: bool | None = None

    @field_validator("email", mode="before")
    @classmethod
    def blank_email(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @field_validator("phone")
    @classmethod
    def phone_format(cls, value: str | None) -> str | None:
        return normalize_phone(value)


# ---------- Roles ----------


class RoleIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter a role name.")
        return value

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str | None) -> str | None:
        return _clean_text(value)


class RoleOut(Schema):
    id: int
    name: str
    description: str | None
    member_count: int = 0
    task_count: int = 0


# ---------- Tasks ----------


class PersonRef(Schema):
    id: int
    full_name: str


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    role_id: int | None = None
    assignee_id: int | None = None
    recurrence: Recurrence = Recurrence.once
    days_of_week: list[int] | None = None
    due_date: date | None = None
    start_date: date | None = None
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    is_active: bool = True

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter a task title.")
        return value

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @field_validator("days_of_week")
    @classmethod
    def valid_days(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None
        if any(day < 0 or day > 6 for day in value):
            raise ValueError("Days run from 0 (Monday) to 6 (Sunday).")
        return sorted(set(value)) or None

    @model_validator(mode="after")
    def consistent(self) -> "TaskIn":
        if self.role_id is not None and self.assignee_id is not None:
            raise ValueError("Assign the task to a role or to one person, not both.")
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValueError("The end time must be later than the start time.")
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("The end date must be on or after the start date.")
        if self.recurrence is Recurrence.specific_days and not self.days_of_week:
            raise ValueError("Pick at least one day of the week.")
        if self.recurrence is not Recurrence.specific_days:
            self.days_of_week = None
        if self.recurrence is not Recurrence.once:
            self.due_date = None
        return self


class TaskActiveIn(BaseModel):
    is_active: bool


class TaskOut(Schema):
    id: int
    title: str
    description: str | None
    role_id: int | None
    assignee_id: int | None
    role: RoleRef | None
    assignee: PersonRef | None
    recurrence: Recurrence
    days_of_week: list[int] | None
    due_date: date | None
    start_date: date | None
    end_date: date | None
    start_time: time | None
    end_time: time | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TaskBrief(Schema):
    id: int
    title: str
    description: str | None
    recurrence: Recurrence
    days_of_week: list[int] | None
    due_date: date | None
    start_time: time | None
    end_time: time | None
    role: RoleRef | None
    assignee: PersonRef | None


# ---------- Occurrences, completions and reports ----------


class CompletionOut(BaseModel):
    id: int
    completed_at: datetime
    is_late: bool
    note: str | None


class OccurrenceOut(BaseModel):
    task: TaskBrief
    scope: Scope
    period_date: date
    due_date: date | None
    status: Status
    can_complete: bool
    completion: CompletionOut | None
    report_date: date | None = None


class TallyOut(BaseModel):
    total: int
    done: int
    late: int
    missed: int
    open: int
    completion_rate: float | None
    on_time_rate: float | None


class DayOut(BaseModel):
    date: date
    today: date
    timezone: str
    summary: TallyOut
    occurrences: list[OccurrenceOut]


class MemberBrief(Schema):
    id: int
    full_name: str
    access_level: AccessLevel
    roles: list[RoleRef]


class BoardMember(BaseModel):
    member: MemberBrief
    summary: TallyOut
    occurrences: list[OccurrenceOut]


class BoardOut(BaseModel):
    date: date
    today: date
    timezone: str
    summary: TallyOut
    members: list[BoardMember]


class DayTally(BaseModel):
    date: date
    total: int
    done: int
    late: int
    missed: int
    open: int


class TaskTally(BaseModel):
    task: TaskBrief
    summary: TallyOut


class MemberTally(BaseModel):
    member: MemberBrief
    summary: TallyOut


class MemberReportOut(BaseModel):
    member: MemberBrief
    start: date
    end: date
    today: date
    summary: TallyOut
    days: list[DayTally]
    tasks: list[TaskTally]
    history: list[OccurrenceOut]


class TeamReportOut(BaseModel):
    start: date
    end: date
    today: date
    summary: TallyOut
    days: list[DayTally]
    members: list[MemberTally]
    tasks: list[TaskTally]


class CompletionIn(BaseModel):
    task_id: int
    period_date: date
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("note")
    @classmethod
    def strip_note(cls, value: str | None) -> str | None:
        return _clean_text(value)
