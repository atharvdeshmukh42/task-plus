"""Team-wide checklists and reports for the owner and supervisors."""

from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import selectinload

from app import services
from app.deps import DB, Manager
from app.models import User
from app.schemas import BoardOut, MemberReportOut, TeamReportOut

router = APIRouter(tags=["reports"])


def _default_range(user: User, start: date | None, end: date | None) -> tuple[date, date]:
    today = services.org_now(user.organization).date()
    end = end or today
    return start or end - timedelta(days=6), end


@router.get("/board", response_model=BoardOut)
def board(user: Manager, db: DB, day: date | None = None, role_id: int | None = None) -> BoardOut:
    return services.board_day(db, user.organization, day, role_id)


@router.get("/reports/team", response_model=TeamReportOut)
def team_report(
    user: Manager, db: DB, start: date | None = None, end: date | None = None, role_id: int | None = None
) -> TeamReportOut:
    start, end = _default_range(user, start, end)
    return services.team_report(db, user.organization, start, end, role_id)


@router.get("/reports/members/{member_id}", response_model=MemberReportOut)
def member_report(
    member_id: int, user: Manager, db: DB, start: date | None = None, end: date | None = None
) -> MemberReportOut:
    member = db.get(User, member_id, options=[selectinload(User.roles)])
    if member is None or member.organization_id != user.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That person isn't in your organization.")
    start, end = _default_range(user, start, end)
    return services.member_report(db, user.organization, member, start, end)
