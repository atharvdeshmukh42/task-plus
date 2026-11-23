from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import AccessLevel, User
from app.security import read_access_token

bearer = HTTPBearer(auto_error=False)

DB = Annotated[Session, Depends(get_db)]


def current_user(
    db: DB, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sign in to continue.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    user_id = read_access_token(credentials.credentials)
    if user_id is None:
        raise unauthorized
    user = db.get(User, user_id, options=[selectinload(User.roles), selectinload(User.organization)])
    if user is None or not user.is_active:
        raise unauthorized
    return user


def manager(user: Annotated[User, Depends(current_user)]) -> User:
    if user.access_level not in (AccessLevel.owner, AccessLevel.supervisor):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner and supervisors can do this.")
    return user


def owner(user: Annotated[User, Depends(current_user)]) -> User:
    if user.access_level is not AccessLevel.owner:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the organization owner can do this.")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
Manager = Annotated[User, Depends(manager)]
Owner = Annotated[User, Depends(owner)]
