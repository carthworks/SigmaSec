from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.database import get_db
from app.models import Org, User
from app.schemas.org import OrgCreate, OrgOut

router = APIRouter(prefix="/orgs", tags=["orgs"])


@router.post("", response_model=OrgOut, status_code=status.HTTP_201_CREATED)
def create_org(
    payload: OrgCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),  # admin only
):
    """
    Create a new organisation.
    Admin only — used during customer onboarding.
    """
    # check slug is unique
    existing = db.query(Org).filter(Org.slug == payload.slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Slug '{payload.slug}' already taken",
        )

    org = Org(name=payload.name, slug=payload.slug)
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@router.get("", response_model=list[OrgOut])
def list_orgs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """List all orgs — admin only."""
    return db.query(Org).all()
