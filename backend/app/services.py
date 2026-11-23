"""Loads tasks, people and completions, and builds checklists and reports from them."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app import scheduling as sched
from app.models import AccessLevel, Organization, Recurrence, Task, TaskCompletion, User
from app.schemas import (
    BoardMember,
    BoardOut,
    CompletionOut,
    DayOut,
    DayTally,
    MemberBrief,
    MemberReportOut,
    MemberTally,
    OccurrenceOut,
    TallyOut,
    TaskBrief,
    TaskTally,
    TeamReportOut,
)

MAX_REPORT_DAYS = 366
_SCOPE_ORDER = {sched.Scope.day: 0, sched.Scope.week: 1, sched.Scope.once: 2}


def org_zone(org: Organization) -> ZoneInfo:
    return ZoneInfo(org.timezone)


def org_now(org: Organization) -> datetime:
    return datetime.now(org_zone(org))


def applies_to(task: Task, member: User) -> bool:
    if task.assignee_id is not None:
        return task.assignee_id == member.id
    if task.role_id is not None:
        return any(role.id == task.role_id for role in member.roles)
    return member.access_level is AccessLevel.employee


def rule_for(task: Task, member: User, zone: ZoneInfo) -> sched.Rule | None:
    return sched.build_rule(
        task_id=task.id,
        recurrence=task.recurrence,
        days_of_week=task.days_of_week,
        due_date=task.due_date,
        start_date=task.start_date,
        end_date=task.end_date,
        start_time=task.start_time,
        end_time=task.end_time,
        created_on=task.created_at.astimezone(zone).date(),
        member_since=member.created_at.astimezone(zone).date(),
        active=task.is_active,
    )


def tally_out(tally: sched.Tally) -> TallyOut:
    return TallyOut(
        total=tally.total,
        done=tally.done,
        late=tally.late,
        missed=tally.missed,
        open=tally.open,
        completion_rate=tally.completion_rate,
        on_time_rate=tally.on_time_rate,
    )


def member_brief(member: User) -> MemberBrief:
    return MemberBrief.model_validate(member)


def occurrence_out(occurrence: sched.Occurrence, task: Task) -> OccurrenceOut:
    done = occurrence.completion
    return OccurrenceOut(
        task=TaskBrief.model_validate(task),
        scope=occurrence.scope,
        period_date=occurrence.period_date,
        due_date=occurrence.due_date,
        status=occurrence.status,
        can_complete=occurrence.can_complete,
        completion=None
        if done is None
        else CompletionOut(id=done.completion_id, completed_at=done.completed_at, is_late=done.is_late, note=done.note),
        report_date=occurrence.report_date,
    )


def _sort_key(item: tuple[sched.Occurrence, Task]) -> tuple:
    occurrence, task = item
    anchor = task.start_time or task.end_time or time.max
    return (_SCOPE_ORDER[occurrence.scope], anchor, task.title.lower(), task.id)


class Snapshot:
    """Everything needed to compute occurrences for some people over some dates."""

    def __init__(self, db: Session, org: Organization, members: Iterable[User], since: date, now: datetime | None):
        self.org = org
        self.zone = org_zone(org)
        self.now = (now or org_now(org)).astimezone(self.zone)
        self.today = self.now.date()
        self.members = list(members)
        self.tasks: list[Task] = list(
            db.scalars(
                select(Task)
                .where(Task.organization_id == org.id)
                .options(selectinload(Task.role), selectinload(Task.assignee))
                .order_by(Task.id)
            )
        )
        self.completions: dict[tuple[int, int], dict[date, sched.Done]] = defaultdict(dict)
        member_ids = [m.id for m in self.members]
        if member_ids and self.tasks:
            rows = db.execute(
                select(TaskCompletion)
                .join(Task, Task.id == TaskCompletion.task_id)
                .where(
                    Task.organization_id == org.id,
                    TaskCompletion.user_id.in_(member_ids),
                    or_(TaskCompletion.period_date >= since - timedelta(days=7), Task.recurrence == Recurrence.once),
                )
            ).scalars()
            for row in rows:
                self.completions[(row.task_id, row.user_id)][row.period_date] = sched.Done(
                    completion_id=row.id,
                    completed_at=row.completed_at.astimezone(self.zone),
                    is_late=row.is_late,
                    note=row.note,
                )

    def rules(self, member: User) -> list[tuple[Task, sched.Rule, dict[date, sched.Done]]]:
        found = []
        for task in self.tasks:
            if not applies_to(task, member):
                continue
            rule = rule_for(task, member, self.zone)
            if rule is not None:
                found.append((task, rule, self.completions.get((task.id, member.id), {})))
        return found

    def day(self, member: User, day: date) -> list[tuple[sched.Occurrence, Task]]:
        items = []
        for task, rule, done in self.rules(member):
            occurrence = sched.occurrence_on(rule, day, done, self.now)
            if occurrence is not None:
                items.append((occurrence, task))
        return sorted(items, key=_sort_key)

    def between(self, member: User, start: date, end: date) -> list[tuple[sched.Occurrence, Task]]:
        items = []
        for task, rule, done in self.rules(member):
            items.extend((occurrence, task) for occurrence in sched.occurrences_between(rule, start, end, done, self.now))
        return items


def _tally(occurrences: Iterable[sched.Occurrence]) -> sched.Tally:
    tally = sched.Tally()
    for occurrence in occurrences:
        tally.add(occurrence.status)
    return tally


def _days(items: list[tuple[sched.Occurrence, Task]], start: date, end: date) -> list[DayTally]:
    by_day: dict[date, sched.Tally] = defaultdict(sched.Tally)
    for occurrence, _ in items:
        if occurrence.report_date is not None:
            by_day[occurrence.report_date].add(occurrence.status)
    days = []
    day = start
    while day <= end:
        t = by_day.get(day, sched.Tally())
        days.append(DayTally(date=day, total=t.total, done=t.done, late=t.late, missed=t.missed, open=t.open))
        day += timedelta(days=1)
    return days


def _tasks(items: list[tuple[sched.Occurrence, Task]]) -> list[TaskTally]:
    grouped: dict[int, tuple[Task, sched.Tally]] = {}
    for occurrence, task in items:
        grouped.setdefault(task.id, (task, sched.Tally()))[1].add(occurrence.status)
    rows = [TaskTally(task=TaskBrief.model_validate(task), summary=tally_out(t)) for task, t in grouped.values()]
    # Most-missed first: that is where a manager looks.
    return sorted(rows, key=lambda r: (-r.summary.missed, -r.summary.late, r.task.title.lower()))


def check_range(start: date, end: date, today: date) -> date:
    if end < start:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The end date must be on or after the start date.")
    if (end - start).days >= MAX_REPORT_DAYS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose a range of one year or less.")
    return min(end, today) if start <= today else end


# ---------- Views ----------


def member_day(db: Session, org: Organization, member: User, day: date | None, now: datetime | None = None) -> DayOut:
    snap = Snapshot(db, org, [member], since=day or (now or org_now(org)).date(), now=now)
    day = day or snap.today
    items = snap.day(member, day)
    return DayOut(
        date=day,
        today=snap.today,
        timezone=org.timezone,
        summary=tally_out(_tally(o for o, _ in items)),
        occurrences=[occurrence_out(o, t) for o, t in items],
    )


def active_members(db: Session, org: Organization, role_id: int | None = None) -> list[User]:
    query = (
        select(User)
        .where(User.organization_id == org.id, User.is_active.is_(True))
        .options(selectinload(User.roles))
        .order_by(User.full_name)
    )
    members = list(db.scalars(query))
    if role_id is not None:
        members = [m for m in members if any(r.id == role_id for r in m.roles)]
    return members


def board_day(
    db: Session, org: Organization, day: date | None, role_id: int | None = None, now: datetime | None = None
) -> BoardOut:
    members = active_members(db, org, role_id)
    snap = Snapshot(db, org, members, since=day or (now or org_now(org)).date(), now=now)
    day = day or snap.today
    rows: list[BoardMember] = []
    total = sched.Tally()
    for member in members:
        items = snap.day(member, day)
        if not items:
            continue
        tally = _tally(o for o, _ in items)
        for occurrence, _ in items:
            total.add(occurrence.status)
        rows.append(
            BoardMember(
                member=member_brief(member),
                summary=tally_out(tally),
                occurrences=[occurrence_out(o, t) for o, t in items],
            )
        )
    return BoardOut(date=day, today=snap.today, timezone=org.timezone, summary=tally_out(total), members=rows)


def member_report(
    db: Session, org: Organization, member: User, start: date, end: date, now: datetime | None = None
) -> MemberReportOut:
    snap = Snapshot(db, org, [member], since=start, now=now)
    end = check_range(start, end, snap.today)
    items = snap.between(member, start, end) if start <= snap.today else []
    history = sorted(
        items,
        key=lambda item: (item[0].report_date or snap.today, _sort_key(item)),
        reverse=True,
    )
    return MemberReportOut(
        member=member_brief(member),
        start=start,
        end=end,
        today=snap.today,
        summary=tally_out(_tally(o for o, _ in items)),
        days=_days(items, start, end),
        tasks=_tasks(items),
        history=[occurrence_out(o, t) for o, t in history],
    )


def team_report(
    db: Session, org: Organization, start: date, end: date, role_id: int | None = None, now: datetime | None = None
) -> TeamReportOut:
    members = active_members(db, org, role_id)
    snap = Snapshot(db, org, members, since=start, now=now)
    end = check_range(start, end, snap.today)
    everything: list[tuple[sched.Occurrence, Task]] = []
    member_rows: list[MemberTally] = []
    for member in members:
        items = snap.between(member, start, end) if start <= snap.today else []
        if not items:
            continue
        everything.extend(items)
        member_rows.append(MemberTally(member=member_brief(member), summary=tally_out(_tally(o for o, _ in items))))
    member_rows.sort(key=lambda r: (r.summary.completion_rate is None, r.summary.completion_rate or 0, r.member.full_name))
    return TeamReportOut(
        start=start,
        end=end,
        today=snap.today,
        summary=tally_out(_tally(o for o, _ in everything)),
        days=_days(everything, start, end),
        members=member_rows,
        tasks=_tasks(everything),
    )


# ---------- Completing tasks ----------


def _locate(snap: Snapshot, member: User, task_id: int, period_date: date):
    for task, rule, done in snap.rules(member):
        if task.id != task_id:
            continue
        if rule.recurrence is Recurrence.once:
            found = sched.period_for(rule, period_date)
        elif rule.recurrence is Recurrence.weekly:
            found = sched.period_for(rule, period_date) if period_date.weekday() == 0 else None
        else:
            found = sched.period_for(rule, period_date)
        if found is None or found[1] != period_date:
            break
        return task, rule, found, done
    raise HTTPException(status.HTTP_404_NOT_FOUND, "This task isn't on your list for that day.")


def complete(
    db: Session, org: Organization, member: User, task_id: int, period_date: date, note: str | None,
    now: datetime | None = None,
) -> OccurrenceOut:
    snap = Snapshot(db, org, [member], since=period_date, now=now)
    task, rule, (scope, period, due), done = _locate(snap, member, task_id, period_date)
    if done.get(period) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This task is already marked done.")
    occurrence = sched.make_occurrence(rule, scope, period, due, None, snap.now)
    if not occurrence.can_complete:
        message = (
            "This task opens later." if occurrence.status is sched.Status.upcoming
            else "This task is closed. Only today's tasks can be marked done."
        )
        raise HTTPException(status.HTTP_409_CONFLICT, message)
    row = TaskCompletion(
        task_id=task.id,
        user_id=member.id,
        period_date=period,
        completed_at=snap.now,
        is_late=sched.is_late(rule, due, snap.now),
        note=note,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This task is already marked done.") from None
    finished = sched.Done(completion_id=row.id, completed_at=snap.now, is_late=row.is_late, note=row.note)
    return occurrence_out(sched.make_occurrence(rule, scope, period, due, finished, snap.now), task)


def undo(db: Session, org: Organization, member: User, completion_id: int, now: datetime | None = None) -> OccurrenceOut:
    row = db.get(TaskCompletion, completion_id)
    if row is None or row.user_id != member.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That completion no longer exists.")
    snap = Snapshot(db, org, [member], since=row.period_date, now=now)
    task, rule, (scope, period, due), _ = _locate(snap, member, row.task_id, row.period_date)
    reopened = sched.make_occurrence(rule, scope, period, due, None, snap.now)
    if not reopened.can_complete:
        raise HTTPException(status.HTTP_409_CONFLICT, "This day has closed, so the task can't be reopened.")
    db.delete(row)
    db.commit()
    return occurrence_out(reopened, task)
