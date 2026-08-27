# app/routers/users.py

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.auth.dependencies import get_user_org_id, require_role
from app.database import get_db
from app.models import User, UserRole
from app.schemas.user import UserCreate, UserOut

router = APIRouter(prefix="/users", tags=["users"])

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(require_role("admin")),
):
    """
    Create a new user inside the current org.
    Admin only.
    org_id always comes from JWT — never from request body.
    """
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{payload.email}' already registered",
        )

    # validate role value
    try:
        role = UserRole(payload.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{payload.role}'. "
            f"Must be: admin, analyst, viewer",
        )

    user = User(
        org_id=org_id,  # from JWT, never user input
        email=payload.email,
        hashed_password=pwd_context.hash(payload.password),
        full_name=payload.full_name,
        role=role,
        is_active=True,
        is_verified=False,  # email verify later (Day 46)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(require_role("admin", "analyst")),
):
    """
    List users in the current org only.
    CRITICAL: filters by org_id from JWT — never shows other orgs' users.
    """
    return (
        db.query(User)
        .filter(User.org_id == org_id)  # org isolation enforced here
        .all()
    )
