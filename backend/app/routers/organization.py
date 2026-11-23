from fastapi import APIRouter

from app.deps import DB, CurrentUser, Owner
from app.schemas import OrganizationOut, OrganizationUpdate

router = APIRouter(prefix="/organization", tags=["organization"])


@router.get("", response_model=OrganizationOut)
def get_organization(user: CurrentUser) -> OrganizationOut:
    return OrganizationOut.model_validate(user.organization)


@router.patch("", response_model=OrganizationOut)
def update_organization(body: OrganizationUpdate, user: Owner, db: DB) -> OrganizationOut:
    org = user.organization
    if body.name is not None:
        org.name = body.name.strip()
    if body.timezone is not None:
        org.timezone = body.timezone
    db.commit()
    return OrganizationOut.model_validate(org)
