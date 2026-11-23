"""Create a demo organization with three weeks of history.

    python -m app.seed           # create it if it doesn't exist
    python -m app.seed --reset   # delete and recreate it

Demo sign-ins (password for all: demo-pass-123):
    owner@example.com       owner (web)
    supervisor@example.com  supervisor (web)
    meera@example.com       employee (mobile)
    9876500001              employee (mobile, phone sign-in)
"""

import argparse
import random
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import scheduling as sched
from app.db import SessionLocal
from app.models import AccessLevel, Organization, Recurrence, Role, Task, TaskCompletion, User
from app.security import hash_password
from app.services import Snapshot

DEMO_ORG = "Harbor Café (demo)"
DEMO_PASSWORD = "demo-pass-123"
HISTORY_DAYS = 21


def _reset(db: Session) -> None:
    for org in db.scalars(select(Organization).where(Organization.name == DEMO_ORG)):
        db.delete(org)
    db.commit()


def seed(db: Session) -> Organization:
    zone_name = "Asia/Kolkata"
    started = datetime.now(UTC) - timedelta(days=HISTORY_DAYS)
    org = Organization(name=DEMO_ORG, timezone=zone_name, created_at=started)
    db.add(org)
    db.flush()

    roles = {
        name: Role(organization_id=org.id, name=name, description=description, created_at=started)
        for name, description in [
            ("Barista", "Front counter and coffee bar"),
            ("Kitchen", "Prep, cooking and food safety"),
            ("Cleaning", "Floors, restrooms and waste"),
        ]
    }
    db.add_all(roles.values())

    password = hash_password(DEMO_PASSWORD)

    def person(name: str, level: AccessLevel, *, email: str | None = None, phone: str | None = None, role_names=()):
        user = User(
            organization_id=org.id,
            full_name=name,
            email=email,
            phone=phone,
            password_hash=password,
            access_level=level,
            roles=[roles[r] for r in role_names],
            created_at=started,
        )
        db.add(user)
        return user

    person("Asha Rao", AccessLevel.owner, email="owner@example.com")
    vikram = person("Vikram Shah", AccessLevel.supervisor, email="supervisor@example.com")
    meera = person("Meera Iyer", AccessLevel.employee, email="meera@example.com", role_names=["Barista"])
    person("Rohan Das", AccessLevel.employee, phone="9876500001", role_names=["Barista", "Cleaning"])
    person("Leena Fernandes", AccessLevel.employee, email="leena@example.com", role_names=["Kitchen"])
    person("Imran Khan", AccessLevel.employee, email="imran@example.com", role_names=["Kitchen", "Cleaning"])
    db.flush()

    today = datetime.now(UTC).astimezone(ZoneInfo(zone_name)).date()

    def task(title: str, **fields) -> Task:
        item = Task(organization_id=org.id, title=title, created_at=started, created_by_id=vikram.id, **fields)
        db.add(item)
        return item

    task(
        "Calibrate the espresso grinder",
        description="Pull two test shots and adjust the grind until each runs 25–30 seconds.",
        role_id=roles["Barista"].id, recurrence=Recurrence.daily, start_time=time(7, 0), end_time=time(8, 0),
    )
    task(
        "Restock milk and syrups",
        role_id=roles["Barista"].id, recurrence=Recurrence.specific_days, days_of_week=[0, 2, 4],
        start_time=time(14, 0), end_time=time(15, 0),
    )
    task(
        "Log fridge and freezer temperatures",
        description="Record each unit in the food-safety sheet. Fridges must read 5 °C or lower.",
        role_id=roles["Kitchen"].id, recurrence=Recurrence.daily, start_time=time(9, 0), end_time=time(9, 30),
    )
    task("Deep clean the oven", role_id=roles["Kitchen"].id, recurrence=Recurrence.weekly)
    task(
        "Mop floors and empty bins",
        role_id=roles["Cleaning"].id, recurrence=Recurrence.daily, start_time=time(21, 0), end_time=time(22, 0),
    )
    task("Sanitize restrooms", role_id=roles["Cleaning"].id, recurrence=Recurrence.specific_days, days_of_week=[1, 3, 5])
    task(
        "Read the updated allergen guide",
        description="It's pinned in the staff room. Ask Vikram if anything is unclear.",
        recurrence=Recurrence.once, due_date=today + timedelta(days=3),
    )
    task("Publish next week's rota", assignee_id=vikram.id, recurrence=Recurrence.weekly)
    task(
        "Count the cash float",
        assignee_id=meera.id, recurrence=Recurrence.daily, start_time=time(21, 30), end_time=time(22, 0),
    )
    db.flush()
    _history(db, org, today)
    db.commit()
    return org


def _history(db: Session, org: Organization, today: date) -> None:
    """Mark most past occurrences done, a few late, and leave some missed."""
    rng = random.Random(7)
    members = list(db.scalars(select(User).where(User.organization_id == org.id)))
    snap = Snapshot(db, org, members, since=today - timedelta(days=HISTORY_DAYS), now=None)
    zone = snap.zone
    reliability = {m.id: rng.uniform(0.7, 0.97) for m in members}
    for member in members:
        for occurrence, task in snap.between(member, today - timedelta(days=HISTORY_DAYS - 1), today):
            if occurrence.status not in (sched.Status.missed, sched.Status.pending, sched.Status.overdue):
                continue
            if occurrence.scope is sched.Scope.once:
                continue
            due = occurrence.due_date or today
            if due >= today and occurrence.scope is sched.Scope.day:
                # Today: only tasks whose window has already closed get done.
                if task.end_time is None or task.end_time > snap.now.time():
                    continue
            if rng.random() > reliability[member.id]:
                continue
            day = occurrence.period_date
            if occurrence.scope is sched.Scope.week:
                last = min(due, today - timedelta(days=1))
                if last < day:
                    continue
                day = day + timedelta(days=rng.randint(0, (last - day).days))
            late = rng.random() < 0.12
            if task.end_time is not None:
                base = datetime.combine(day, task.end_time) - timedelta(minutes=rng.randint(5, 40))
                if late:
                    base = datetime.combine(day, task.end_time) + timedelta(minutes=rng.randint(10, 90))
            else:
                base = datetime.combine(day, time(rng.randint(10, 18), rng.randint(0, 59)))
                late = False
            completed_at = base.replace(tzinfo=zone)
            if completed_at > snap.now:
                continue
            rule = next(r for t, r, _ in snap.rules(member) if t.id == task.id)
            db.add(
                TaskCompletion(
                    task_id=task.id,
                    user_id=member.id,
                    period_date=occurrence.period_date,
                    completed_at=completed_at,
                    is_late=sched.is_late(rule, occurrence.due_date, completed_at),
                )
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="delete the demo organization first")
    args = parser.parse_args()
    with SessionLocal() as db:
        if args.reset:
            _reset(db)
        elif db.scalar(select(Organization.id).where(Organization.name == DEMO_ORG)):
            print(f"{DEMO_ORG} already exists. Use --reset to recreate it.")
            return
        org = seed(db)
        print(f"Created {org.name}. Sign in as owner@example.com with password {DEMO_PASSWORD}.")


if __name__ == "__main__":
    main()
