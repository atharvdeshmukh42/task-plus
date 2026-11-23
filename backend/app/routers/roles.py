from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import DB, CurrentUser, Manager
from app.models import Role, Task, User, user_roles
from app.schemas import RoleIn, RoleOut

router = APIRouter(prefix="/roles", tags=["roles"])


def _role_out(db: Session, role: Role) -> RoleOut:
    members = db.scalar(
        select(func.count())
        .select_from(user_roles)
        .join(User, User.id == user_roles.c.user_id)
        .where(user_roles.c.role_id == role.id, User.is_active.is_(True))
    )
    tasks = db.scalar(select(func.count()).select_from(Task).where(Task.role_id == role.id))
    return RoleOut(id=role.id, name=role.name, description=role.description, member_count=members or 0, task_count=tasks or 0)


def _get_role(db: Session, org_id: int, role_id: int) -> Role:
    role = db.get(Role, role_id)
    if role is None or role.organization_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That role doesn't exist.")
    return role


def _save(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A role with this name already exists.") from None


@router.get("", response_model=list[RoleOut])
def list_roles(user: CurrentUser, db: DB) -> list[RoleOut]:
    roles = db.scalars(select(Role).where(Role.organization_id == user.organization_id).order_by(func.lower(Role.name)))
    return [_role_out(db, role) for role in roles]


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(body: RoleIn, user: Manager, db: DB) -> RoleOut:
    role = Role(organization_id=user.organization_id, name=body.name, description=body.description)
    db.add(role)
    _save(db)
    return _role_out(db, role)


@router.patch("/{role_id}", response_model=RoleOut)
def update_role(role_id: int, body: RoleIn, user: Manager, db: DB) -> RoleOut:
    role = _get_role(db, user.organization_id, role_id)
    role.name = body.name
    role.description = body.description
    _save(db)
    return _role_out(db, role)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: int, user: Manager, db: DB) -> Response:
    role = _get_role(db, user.organization_id, role_id)
    task_count = db.scalar(select(func.count()).select_from(Task).where(Task.role_id == role.id)) or 0
    if task_count:
        noun = "task is" if task_count == 1 else "tasks are"
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{task_count} {noun} assigned to {role.name}. Reassign or delete them first.",
        )
    db.delete(role)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
