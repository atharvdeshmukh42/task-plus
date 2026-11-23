"""The signed-in person's own checklist and report. Used by the mobile app."""

from datetime import date, timedelta

from fastapi import APIRouter

from app import services
from app.deps import DB, CurrentUser
from app.schemas import CompletionIn, DayOut, MemberReportOut, OccurrenceOut

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/day", response_model=DayOut)
def my_day(user: CurrentUser, db: DB, day: date | None = None) -> DayOut:
    return services.member_day(db, user.organization, user, day)


@router.post("/completions", response_model=OccurrenceOut, status_code=201)
def complete_task(body: CompletionIn, user: CurrentUser, db: DB) -> OccurrenceOut:
    return services.complete(db, user.organization, user, body.task_id, body.period_date, body.note)


@router.delete("/completions/{completion_id}", response_model=OccurrenceOut)
def undo_completion(completion_id: int, user: CurrentUser, db: DB) -> OccurrenceOut:
    return services.undo(db, user.organization, user, completion_id)


@router.get("/report", response_model=MemberReportOut)
def my_report(user: CurrentUser, db: DB, start: date | None = None, end: date | None = None) -> MemberReportOut:
    today = services.org_now(user.organization).date()
    end = end or today
    start = start or end - timedelta(days=6)
    return services.member_report(db, user.organization, user, start, end)
