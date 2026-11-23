from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DB, CurrentUser
from app.models import AccessLevel, Organization, User
from app.schemas import ChangePasswordIn, LoginIn, MeOut, OrganizationOut, SessionOut, SignupIn, UserOut, normalize_phone
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def session_for(user: User) -> SessionOut:
    return SessionOut(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
        organization=OrganizationOut.model_validate(user.organization),
    )


@router.post("/signup", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, db: DB) -> SessionOut:
    email = body.email.lower()
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Sign in instead.")
    org = Organization(name=body.organization_name, timezone=body.timezone)
    owner = User(
        organization=org,
        full_name=body.full_name,
        email=email,
        password_hash=hash_password(body.password),
        access_level=AccessLevel.owner,
        roles=[],
    )
    db.add_all([org, owner])
    db.commit()
    db.refresh(owner)
    return session_for(owner)


@router.post("/login", response_model=SessionOut)
def login(body: LoginIn, db: DB) -> SessionOut:
    identifier = body.identifier.strip()
    query = select(User).options(selectinload(User.roles), selectinload(User.organization))
    if "@" in identifier:
        query = query.where(func.lower(User.email) == identifier.lower())
    else:
        try:
            phone = normalize_phone(identifier)
        except ValueError:
            phone = None
        query = query.where(User.phone == phone)
    user = db.scalar(query)
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "That email, phone number or password is incorrect.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated. Ask your supervisor.")
    return session_for(user)


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser) -> MeOut:
    return MeOut(user=UserOut.model_validate(user), organization=OrganizationOut.model_validate(user.organization))


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(body: ChangePasswordIn, user: CurrentUser, db: DB) -> None:
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is incorrect.")
    user.password_hash = hash_password(body.new_password)
    db.commit()
