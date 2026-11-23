from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.deps import DB, Manager
from app.models import AccessLevel, Role, User
from app.schemas import MemberCreate, MemberUpdate, UserOut
from app.security import hash_password

router = APIRouter(prefix="/members", tags=["members"])


def _get_member(db: Session, org_id: int, member_id: int) -> User:
    member = db.get(User, member_id, options=[selectinload(User.roles)])
    if member is None or member.organization_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That person isn't in your organization.")
    return member


def _roles(db: Session, org_id: int, role_ids: list[int]) -> list[Role]:
    if not role_ids:
        return []
    roles = list(db.scalars(select(Role).where(Role.organization_id == org_id, Role.id.in_(set(role_ids)))))
    if len(roles) != len(set(role_ids)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "One of the chosen roles no longer exists.")
    return roles


def _ensure_unique_contact(db: Session, email: str | None, phone: str | None, exclude_id: int | None = None) -> None:
    if email:
        query = select(User.id).where(func.lower(User.email) == email.lower())
        if exclude_id is not None:
            query = query.where(User.id != exclude_id)
        if db.scalar(query):
            raise HTTPException(status.HTTP_409_CONFLICT, "Someone already uses this email address.")
    if phone:
        query = select(User.id).where(User.phone == phone)
        if exclude_id is not None:
            query = query.where(User.id != exclude_id)
        if db.scalar(query):
            raise HTTPException(status.HTTP_409_CONFLICT, "Someone already uses this phone number.")


@router.get("", response_model=list[UserOut])
def list_members(
    user: Manager,
    db: DB,
    q: str | None = None,
    role_id: int | None = None,
    access_level: AccessLevel | None = None,
    include_inactive: bool = Query(default=False),
) -> list[User]:
    query = (
        select(User)
        .where(User.organization_id == user.organization_id)
        .options(selectinload(User.roles))
        .order_by(User.is_active.desc(), User.full_name)
    )
    if not include_inactive:
        query = query.where(User.is_active.is_(True))
    if access_level is not None:
        query = query.where(User.access_level == access_level)
    if role_id is not None:
        query = query.where(User.roles.any(Role.id == role_id))
    if q:
        like = f"%{q.strip()}%"
        query = query.where(or_(User.full_name.ilike(like), User.email.ilike(like), User.phone.ilike(like)))
    return list(db.scalars(query))


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_member(body: MemberCreate, user: Manager, db: DB) -> User:
    if body.access_level == "supervisor" and user.access_level is not AccessLevel.owner:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can add supervisors.")
    email = body.email.lower() if body.email else None
    _ensure_unique_contact(db, email, body.phone)
    member = User(
        organization_id=user.organization_id,
        full_name=body.full_name,
        email=email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        access_level=AccessLevel(body.access_level),
        roles=_roles(db, user.organization_id, body.role_ids),
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.get("/{member_id}", response_model=UserOut)
def get_member(member_id: int, user: Manager, db: DB) -> User:
    return _get_member(db, user.organization_id, member_id)


@router.patch("/{member_id}", response_model=UserOut)
def update_member(member_id: int, body: MemberUpdate, user: Manager, db: DB) -> User:
    member = _get_member(db, user.organization_id, member_id)
    changes = body.model_fields_set
    is_self = member.id == user.id
    is_owner = user.access_level is AccessLevel.owner

    if member.access_level is AccessLevel.owner and not is_self:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can change the owner's details.")
    if member.access_level is AccessLevel.supervisor and not (is_owner or is_self):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can change a supervisor's details.")
    if "access_level" in changes and body.access_level is not None:
        if not is_owner:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can make someone a supervisor.")
        if member.access_level is AccessLevel.owner:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The owner's access can't be changed.")
    if "is_active" in changes and body.is_active is False and (is_self or member.access_level is AccessLevel.owner):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "You can't deactivate this account.")

    email = member.email
    phone = member.phone
    if "email" in changes:
        email = body.email.lower() if body.email else None
    if "phone" in changes:
        phone = body.phone
    if not email and not phone:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Keep an email address or a phone number for sign-in.")
    _ensure_unique_contact(db, email if email != member.email else None, phone if phone != member.phone else None, member.id)
    member.email, member.phone = email, phone

    if body.full_name is not None:
        member.full_name = body.full_name.strip()
    if body.password:
        member.password_hash = hash_password(body.password)
    if body.access_level is not None and "access_level" in changes:
        member.access_level = AccessLevel(body.access_level)
    if body.role_ids is not None:
        member.roles = _roles(db, user.organization_id, body.role_ids)
    if body.is_active is not None:
        member.is_active = body.is_active
    db.commit()
    db.refresh(member)
    return member
