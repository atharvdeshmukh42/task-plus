"""Turns a task's optional schedule into dated occurrences for one person.

Nothing here touches the database, so every rule is unit-tested directly.

Vocabulary
- period_date: the key a completion is stored under. The day itself for daily and
  weekday tasks, the Monday for weekly tasks, and a fixed anchor for one-time tasks.
- due_date: the last day the occurrence can be done on time (None = no deadline).
- Statuses: upcoming (in the future), pending (can be done now), overdue (today, but
  past the end of the time window), done, late (done after the deadline), missed
  (the deadline day has passed and it was not done).
"""

from __future__ import annotations

import enum
from collections.abc import Iterator, Mapping
from dataclasses import dataclass, replace
from datetime import date, datetime, time, timedelta

from app.models import Recurrence

END_OF_DAY = time(23, 59, 59, 999999)


class Status(str, enum.Enum):
    upcoming = "upcoming"
    pending = "pending"
    overdue = "overdue"
    done = "done"
    late = "late"
    missed = "missed"


class Scope(str, enum.Enum):
    day = "day"
    week = "week"
    once = "once"


@dataclass(frozen=True)
class Rule:
    """The scheduling-relevant part of a task, with defaults already resolved."""

    task_id: int
    recurrence: Recurrence
    days_of_week: tuple[int, ...]
    due_date: date | None
    start_date: date  # first day the person should see it
    end_date: date | None
    start_time: time | None
    end_time: time | None
    active: bool = True


@dataclass(frozen=True)
class Done:
    completion_id: int
    completed_at: datetime  # in the organization's timezone
    is_late: bool
    note: str | None = None


@dataclass(frozen=True)
class Occurrence:
    task_id: int
    scope: Scope
    period_date: date
    due_date: date | None
    status: Status
    can_complete: bool
    completion: Done | None
    report_date: date | None  # the day this occurrence is counted on in reports


def week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def build_rule(
    *,
    task_id: int,
    recurrence: Recurrence,
    days_of_week: list[int] | None,
    due_date: date | None,
    start_date: date | None,
    end_date: date | None,
    start_time: time | None,
    end_time: time | None,
    created_on: date,
    member_since: date,
    active: bool = True,
) -> Rule | None:
    """Resolve defaults. Returns None when the person can never see the task."""
    start = start_date or created_on
    if recurrence is Recurrence.once and due_date is not None and start_date is None:
        start = min(start, due_date)
    start = max(start, member_since)
    if recurrence is Recurrence.once and due_date is not None and due_date < start:
        return None
    if end_date is not None and end_date < start:
        return None
    days = tuple(sorted(set(days_of_week or [])))
    if recurrence is Recurrence.specific_days and not days:
        recurrence = Recurrence.daily
    return Rule(
        task_id=task_id,
        recurrence=recurrence,
        days_of_week=days,
        due_date=due_date,
        start_date=start,
        end_date=end_date,
        start_time=start_time,
        end_time=end_time,
        active=active,
    )


def deadline(rule: Rule, due: date | None) -> datetime | None:
    if due is None:
        return None
    return datetime.combine(due, rule.end_time or END_OF_DAY)


def is_late(rule: Rule, due: date | None, completed_at: datetime) -> bool:
    limit = deadline(rule, due)
    return limit is not None and completed_at.replace(tzinfo=None) > limit


def _in_window(rule: Rule, day: date) -> bool:
    return rule.start_date <= day and (rule.end_date is None or day <= rule.end_date)


def _once_anchor(rule: Rule) -> date:
    return rule.due_date or rule.start_date


def period_for(rule: Rule, day: date) -> tuple[Scope, date, date | None] | None:
    """The recurring occurrence that falls on `day`, ignoring completion state."""
    if rule.recurrence is Recurrence.once:
        return Scope.once, _once_anchor(rule), rule.due_date
    if rule.recurrence is Recurrence.weekly:
        monday = week_start(day)
        due = monday + timedelta(days=6)
        if rule.end_date is not None:
            due = min(due, rule.end_date)
        if due < rule.start_date or (rule.end_date is not None and monday > rule.end_date):
            return None
        return Scope.week, monday, due
    if not _in_window(rule, day):
        return None
    if rule.recurrence is Recurrence.specific_days and day.weekday() not in rule.days_of_week:
        return None
    return Scope.day, day, day


def _status(rule: Rule, scope: Scope, period: date, due: date | None, done: Done | None, now: datetime) -> Status:
    if done is not None:
        return Status.late if done.is_late else Status.done
    today = now.date()
    opens = rule.start_date if scope is Scope.once else max(period, rule.start_date)
    if opens > today:
        return Status.upcoming
    if due is None:
        return Status.pending
    if today > due:
        return Status.missed
    limit = deadline(rule, due)
    if limit is not None and now.replace(tzinfo=None) > limit:
        return Status.overdue
    return Status.pending


def _can_complete(rule: Rule, scope: Scope, period: date, done: Done | None, today: date) -> bool:
    if done is not None or not rule.active:
        return False
    if scope is Scope.once:
        return rule.start_date <= today
    if scope is Scope.week:
        return period == week_start(today) and max(period, rule.start_date) <= today
    return period == today


def _report_date(scope: Scope, period: date, due: date | None, done: Done | None, today: date) -> date | None:
    if scope is Scope.day:
        return period
    if done is not None:
        return done.completed_at.date()
    if due is None:
        return None
    return min(due, today) if scope is Scope.week else due


def make_occurrence(rule: Rule, scope: Scope, period: date, due: date | None, done: Done | None, now: datetime) -> Occurrence:
    today = now.date()
    return Occurrence(
        task_id=rule.task_id,
        scope=scope,
        period_date=period,
        due_date=due,
        status=_status(rule, scope, period, due, done, now),
        can_complete=_can_complete(rule, scope, period, done, today),
        completion=done,
        report_date=_report_date(scope, period, due, done, today),
    )


def occurrence_on(rule: Rule, day: date, completions: Mapping[date, Done], now: datetime) -> Occurrence | None:
    """What the person sees for this task on `day` (a checklist row), or None."""
    today = now.date()
    found = period_for(rule, day)
    if found is None:
        return None
    scope, period, due = found
    done = completions.get(period)
    if not rule.active and done is None:
        return None

    if scope is Scope.once:
        if done is not None:
            # Done one-time tasks appear on the day they were done.
            if done.completed_at.date() != day:
                return None
        elif day < rule.start_date:
            return None
        elif day == today:
            pass  # open one-time tasks always appear today, including overdue ones
        elif day < today:
            if due != day:
                return None  # in history, show an unfinished one-time task on its due day only
        elif due is None or day > due:
            return None  # in the future, show it until its due day
    return make_occurrence(rule, scope, period, due, done, now)


def occurrences_between(
    rule: Rule, start: date, end: date, completions: Mapping[date, Done], now: datetime
) -> Iterator[Occurrence]:
    """Each occurrence counted in a report for [start, end], once per period."""
    today = now.date()
    end = min(end, today)
    if start > end:
        return

    if rule.recurrence is Recurrence.once:
        scope, period, due = Scope.once, _once_anchor(rule), rule.due_date
        done = completions.get(period)
        if not rule.active and done is None:
            return
        occurrence = make_occurrence(rule, scope, period, due, done, now)
        if occurrence.status is Status.upcoming:
            return
        if occurrence.report_date is None:
            if rule.start_date <= end:
                yield occurrence  # open task without a deadline: counted as open
        elif start <= occurrence.report_date <= end:
            yield occurrence
        return

    if rule.recurrence is Recurrence.weekly:
        # Every week that overlaps the range counts once, on a day inside the range.
        monday = week_start(max(start, rule.start_date))
        while monday <= end:
            found = period_for(rule, monday)
            if found is not None:
                scope, period, due = found
                done = completions.get(period)
                if rule.active or done is not None:
                    occurrence = make_occurrence(rule, scope, period, due, done, now)
                    if occurrence.status is not Status.upcoming and occurrence.report_date is not None:
                        clipped = min(max(occurrence.report_date, start), end)
                        yield replace(occurrence, report_date=clipped)
            monday += timedelta(days=7)
        return

    day = max(start, rule.start_date)
    last = end if rule.end_date is None else min(end, rule.end_date)
    while day <= last:
        found = period_for(rule, day)
        if found is not None:
            scope, period, due = found
            done = completions.get(period)
            if rule.active or done is not None:
                yield make_occurrence(rule, scope, period, due, done, now)
        day += timedelta(days=1)


@dataclass
class Tally:
    total: int = 0
    done: int = 0
    late: int = 0
    missed: int = 0
    open: int = 0

    def add(self, status: Status) -> None:
        if status is Status.upcoming:
            return
        self.total += 1
        if status is Status.done:
            self.done += 1
        elif status is Status.late:
            self.late += 1
        elif status is Status.missed:
            self.missed += 1
        else:
            self.open += 1

    @property
    def closed(self) -> int:
        return self.done + self.late + self.missed

    @property
    def completion_rate(self) -> float | None:
        return round((self.done + self.late) / self.closed, 4) if self.closed else None

    @property
    def on_time_rate(self) -> float | None:
        return round(self.done / self.closed, 4) if self.closed else None
