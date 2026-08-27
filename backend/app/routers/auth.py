# app/routers/auth.py

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.jwt import create_access_token
from app.database import get_db
from app.models import User, Org, UserRole
from app.schemas.auth import TokenResponse, UserOut, UserSignup
import re
import secrets

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def slugify(s: str) -> str:
    # Lowercase, replace non-alphanumeric with hyphens, strip trailing hyphens
    slug = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return slug or "org"


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(
    payload: UserSignup,
    db: Session = Depends(get_db),
):
    """
    Registers a new organization and its primary administrator account.
    """
    # 1. Check if user already exists
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{payload.email}' already registered",
        )

    # 2. Create Org with slugified name + collision handling
    base_slug = slugify(payload.org_name)
    slug = base_slug
    while db.query(Org).filter(Org.slug == slug).first():
        slug = f"{base_slug}-{secrets.token_hex(2)}"

    org = Org(name=payload.org_name, slug=slug)
    db.add(org)
    db.flush()  # Generate org.id

    # 3. Create User with role admin
    user = User(
        org_id=org.id,
        email=payload.email,
        hashed_password=pwd_context.hash(payload.password),
        full_name=payload.full_name,
        role=UserRole.admin,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/token", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    OAuth2 password flow.
    Karthik's Auth.js CredentialsProvider calls this endpoint.
    Returns JWT on success, 401 on failure.
    """
    # find user by email
    user = (
        db.query(User)
        .filter(User.email == form_data.username)  # OAuth2 form uses 'username' field
        .first()
    )

    # verify password
    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled",
        )

    # create JWT with user info embedded
    token = create_access_token(
        data={
            "sub": str(user.id),
            "org_id": str(user.org_id),
            "role": user.role.value,
            "email": user.email,
        }
    )

    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the currently logged-in user's profile.
    Karthik calls this after login to populate the session.
    """
    return current_user

