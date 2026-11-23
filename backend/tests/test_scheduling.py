from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from app.models import Recurrence
from app.scheduling import Done, Scope, Status, Tally, build_rule, is_late, occurrence_on, occurrences_between

ZONE = ZoneInfo("Asia/Kolkata")
MON = date(2026, 11, 16)  # a Monday


def at(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute), tzinfo=ZONE)


def rule(recurrence=Recurrence.daily, *, created=date(2026, 11, 1), member_since=date(2026, 11, 1), **fields):
    defaults = dict(days_of_week=None, due_date=None, start_date=None, end_date=None, start_time=None, end_time=None)
    defaults.update(fields)
    return build_rule(task_id=1, recurrence=recurrence, created_on=created, member_since=member_since, **defaults)


def done(when: datetime, late: bool = False) -> Done:
    return Done(completion_id=1, completed_at=when, is_late=late)


class TestDaily:
    def test_pending_inside_the_window_then_overdue_then_missed(self):
        r = rule(start_time=time(9), end_time=time(11))
        assert occurrence_on(r, MON, {}, at(MON, 10)).status is Status.pending
        assert occurrence_on(r, MON, {}, at(MON, 12)).status is Status.overdue
        assert occurrence_on(r, MON, {}, at(MON.replace(day=17), 8)).status is Status.missed

    def test_only_today_can_be_completed(self):
        r = rule()
        now = at(MON, 10)
        assert occurrence_on(r, MON, {}, now).can_complete
        assert not occurrence_on(r, MON.replace(day=15), {}, now).can_complete
        assert occurrence_on(r, MON.replace(day=17), {}, now).status is Status.upcoming

    def test_late_completion_after_end_time(self):
        r = rule(end_time=time(11))
        assert not is_late(r, MON, at(MON, 10, 59))
        assert is_late(r, MON, at(MON, 11, 1))

    def test_no_time_window_is_never_late_on_the_day(self):
        r = rule()
        assert not is_late(r, MON, at(MON, 23, 59))

    def test_respects_start_and_end_dates(self):
        r = rule(start_date=date(2026, 11, 17), end_date=date(2026, 11, 18))
        now = at(date(2026, 11, 20), 9)
        assert occurrence_on(r, MON, {}, now) is None
        assert occurrence_on(r, date(2026, 11, 17), {}, now) is not None
        assert occurrence_on(r, date(2026, 11, 19), {}, now) is None


class TestSpecificDays:
    def test_only_on_chosen_weekdays(self):
        r = rule(Recurrence.specific_days, days_of_week=[0, 2, 4])  # Mon, Wed, Fri
        now = at(date(2026, 11, 22), 9)
        week = [occurrence_on(r, date(2026, 11, 16 + i), {}, now) is not None for i in range(7)]
        assert week == [True, False, True, False, True, False, False]

    def test_no_days_chosen_behaves_like_daily(self):
        r = rule(Recurrence.specific_days, days_of_week=[])
        assert r.recurrence is Recurrence.daily


class TestWeekly:
    def test_one_period_per_week_keyed_by_monday(self):
        r = rule(Recurrence.weekly)
        now = at(date(2026, 11, 19), 9)  # Thursday
        occurrence = occurrence_on(r, date(2026, 11, 19), {}, now)
        assert occurrence.scope is Scope.week
        assert occurrence.period_date == MON
        assert occurrence.due_date == date(2026, 11, 22)
        assert occurrence.can_complete

    def test_done_once_covers_the_whole_week(self):
        r = rule(Recurrence.weekly)
        completions = {MON: done(at(date(2026, 11, 17), 12))}
        now = at(date(2026, 11, 19), 9)
        assert occurrence_on(r, date(2026, 11, 19), completions, now).status is Status.done

    def test_missed_after_sunday(self):
        r = rule(Recurrence.weekly)
        assert occurrence_on(r, date(2026, 11, 20), {}, at(date(2026, 11, 23), 9)).status is Status.missed

    def test_report_counts_each_overlapping_week_once(self):
        r = rule(Recurrence.weekly)
        now = at(date(2026, 11, 25), 9)  # Wednesday of the following week
        found = list(occurrences_between(r, date(2026, 11, 18), date(2026, 11, 25), {}, now))
        assert [o.period_date for o in found] == [MON, date(2026, 11, 23)]
        assert [o.status for o in found] == [Status.missed, Status.pending]
        assert all(date(2026, 11, 18) <= o.report_date <= date(2026, 11, 25) for o in found)


class TestOnce:
    def test_without_due_date_stays_open_and_never_missed(self):
        r = rule(Recurrence.once)
        later = date(2026, 12, 30)
        occurrence = occurrence_on(r, later, {}, at(later, 9))
        assert occurrence.status is Status.pending and occurrence.can_complete

    def test_with_due_date_shows_until_due_then_overdue_today_only(self):
        due = date(2026, 11, 20)
        r = rule(Recurrence.once, due_date=due)
        now = at(date(2026, 11, 22), 9)
        assert occurrence_on(r, date(2026, 11, 22), {}, now).status is Status.missed
        assert occurrence_on(r, date(2026, 11, 22), {}, now).can_complete  # can still be done, late
        assert occurrence_on(r, date(2026, 11, 21), {}, now) is None  # history shows it on its due day only
        assert occurrence_on(r, due, {}, now).status is Status.missed
        assert is_late(r, due, now)

    def test_future_days_show_it_until_due(self):
        due = date(2026, 11, 20)
        r = rule(Recurrence.once, due_date=due)
        now = at(MON, 9)
        assert occurrence_on(r, date(2026, 11, 18), {}, now) is not None
        assert occurrence_on(r, date(2026, 11, 21), {}, now) is None

    def test_done_appears_on_the_completion_day(self):
        r = rule(Recurrence.once)
        anchor = r.start_date
        completions = {anchor: done(at(date(2026, 11, 18), 15))}
        now = at(date(2026, 11, 20), 9)
        assert occurrence_on(r, date(2026, 11, 18), completions, now).status is Status.done
        assert occurrence_on(r, date(2026, 11, 20), completions, now) is None


class TestMembershipAndPausing:
    def test_new_member_has_no_earlier_occurrences(self):
        r = rule(member_since=date(2026, 11, 18))
        found = list(occurrences_between(r, MON, date(2026, 11, 19), {}, at(date(2026, 11, 19), 9)))
        assert [o.period_date for o in found] == [date(2026, 11, 18), date(2026, 11, 19)]

    def test_one_time_task_due_before_joining_is_invisible(self):
        assert rule(Recurrence.once, due_date=MON, member_since=date(2026, 11, 18)) is None

    def test_paused_task_keeps_completed_history_only(self):
        r = build_rule(
            task_id=1, recurrence=Recurrence.daily, days_of_week=None, due_date=None, start_date=None,
            end_date=None, start_time=None, end_time=None, created_on=MON, member_since=MON, active=False,
        )
        completions = {MON: done(at(MON, 10))}
        found = list(occurrences_between(r, MON, date(2026, 11, 18), completions, at(date(2026, 11, 18), 9)))
        assert [o.status for o in found] == [Status.done]
        assert occurrence_on(r, date(2026, 11, 18), {}, at(date(2026, 11, 18), 9)) is None


def test_tally_rates_ignore_open_work():
    tally = Tally()
    for status in [Status.done, Status.done, Status.late, Status.missed, Status.pending, Status.upcoming]:
        tally.add(status)
    assert (tally.total, tally.done, tally.late, tally.missed, tally.open) == (5, 2, 1, 1, 1)
    assert tally.completion_rate == 0.75
    assert tally.on_time_rate == 0.5
