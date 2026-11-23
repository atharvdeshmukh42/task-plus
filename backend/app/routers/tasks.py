from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.deps import DB, Manager
from app.models import Recurrence, Role, Task, User
from app.schemas import TaskActiveIn, TaskIn, TaskOut

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _get_task(db: Session, org_id: int, task_id: int) -> Task:
    task = db.get(Task, task_id, options=[selectinload(Task.role), selectinload(Task.assignee)])
    if task is None or task.organization_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That task doesn't exist.")
    return task


def _check_targets(db: Session, org_id: int, body: TaskIn) -> None:
    if body.role_id is not None:
        role = db.get(Role, body.role_id)
        if role is None or role.organization_id != org_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The chosen role no longer exists.")
    if body.assignee_id is not None:
        person = db.get(User, body.assignee_id)
        if person is None or person.organization_id != org_id or not person.is_active:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The chosen person isn't an active member.")


def _apply(task: Task, body: TaskIn) -> None:
    for field, value in body.model_dump().items():
        setattr(task, field, value)


@router.get("", response_model=list[TaskOut])
def list_tasks(
    user: Manager,
    db: DB,
    q: str | None = None,
    role_id: int | None = None,
    assignee_id: int | None = None,
    recurrence: Recurrence | None = None,
    active: bool | None = None,
) -> list[Task]:
    query = (
        select(Task)
        .where(Task.organization_id == user.organization_id)
        .options(selectinload(Task.role), selectinload(Task.assignee))
        .order_by(Task.is_active.desc(), func.lower(Task.title))
    )
    if q:
        like = f"%{q.strip()}%"
        query = query.where(or_(Task.title.ilike(like), Task.description.ilike(like)))
    if role_id is not None:
        query = query.where(Task.role_id == role_id)
    if assignee_id is not None:
        query = query.where(Task.assignee_id == assignee_id)
    if recurrence is not None:
        query = query.where(Task.recurrence == recurrence)
    if active is not None:
        query = query.where(Task.is_active.is_(active))
    return list(db.scalars(query))


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(body: TaskIn, user: Manager, db: DB) -> Task:
    _check_targets(db, user.organization_id, body)
    task = Task(organization_id=user.organization_id, created_by_id=user.id)
    _apply(task, body)
    db.add(task)
    db.commit()
    return _get_task(db, user.organization_id, task.id)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, user: Manager, db: DB) -> Task:
    return _get_task(db, user.organization_id, task_id)


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, body: TaskIn, user: Manager, db: DB) -> Task:
    task = _get_task(db, user.organization_id, task_id)
    _check_targets(db, user.organization_id, body)
    _apply(task, body)
    db.commit()
    db.expire(task)
    return _get_task(db, user.organization_id, task_id)


@router.patch("/{task_id}", response_model=TaskOut)
def set_task_active(task_id: int, body: TaskActiveIn, user: Manager, db: DB) -> Task:
    task = _get_task(db, user.organization_id, task_id)
    task.is_active = body.is_active
    db.commit()
    return _get_task(db, user.organization_id, task_id)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, user: Manager, db: DB) -> Response:
    task = _get_task(db, user.organization_id, task_id)
    db.delete(task)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
