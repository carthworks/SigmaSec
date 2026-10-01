# app/routers/verifications.py
"""
Target ownership verification.

POST   /target-verifications             start (or reuse) a verification for a domain or IP
GET    /target-verifications             list the organisation's verifications
POST   /target-verifications/{id}/check  look for the DNS record / file and mark verified
DELETE /target-verifications/{id}        revoke
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_user_org_id, require_role
from app.database import get_db
from app.models import AuditLog, TargetVerification, User
from app.security import ownership
from app.security.enforcement import is_current
from app.security.targets import TargetNotAllowed, normalise_scope

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/target-verifications", tags=["target-verifications"])


class VerificationIn(BaseModel):
    target: str  # domain, URL or IP
    method: Literal["dns_txt", "http_file"] = "dns_txt"


class VerificationOut(BaseModel):
    id: uuid.UUID
    scope: str
    method: str
    status: Literal["verified", "pending", "expired"]
    verified_at: Optional[datetime]
    last_checked_at: Optional[datetime]
    last_check_detail: Optional[str]
    instructions: dict


def _out(v: TargetVerification) -> VerificationOut:
    if is_current(v):
        state = "verified"
    elif v.verified_at:
        state = "expired"
    else:
        state = "pending"
    return VerificationOut(
        id=v.id,
        scope=v.scope,
        method=v.method,
        status=state,
        verified_at=v.verified_at,
        last_checked_at=v.last_checked_at,
        last_check_detail=v.last_check_detail,
        instructions=ownership.instructions(v.scope, v.method, v.token),
    )


def _audit(db: Session, org_id, user_id, action: str, v: TargetVerification, extra: Optional[dict] = None):
    db.add(AuditLog(
        org_id=org_id,
        user_id=user_id,
        action=action,
        target_type="target_verification",
        target_id=str(v.id),
        details={"scope": v.scope, "method": v.method, **(extra or {})},
    ))


def _get_owned(db: Session, org_id, verification_id: uuid.UUID) -> TargetVerification:
    v = (
        db.query(TargetVerification)
        .filter(TargetVerification.id == verification_id, TargetVerification.org_id == org_id)
        .first()
    )
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")
    return v


@router.get("", response_model=List[VerificationOut])
def list_verifications(
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(require_role("admin", "analyst", "viewer")),
):
    rows = (
        db.query(TargetVerification)
        .filter(TargetVerification.org_id == org_id)
        .order_by(TargetVerification.created_at.desc())
        .all()
    )
    return [_out(v) for v in rows]


@router.post("", response_model=VerificationOut, status_code=status.HTTP_201_CREATED)
def start_verification(
    payload: VerificationIn,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(require_role("admin")),
):
    try:
        scope = normalise_scope(payload.target)
        ownership.validate_method_for_scope(scope, payload.method)
    except TargetNotAllowed as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    existing = (
        db.query(TargetVerification)
        .filter(
            TargetVerification.org_id == org_id,
            TargetVerification.scope == scope,
            TargetVerification.method == payload.method,
        )
        .first()
    )
    if existing:
        return _out(existing)

    v = TargetVerification(
        org_id=org_id,
        scope=scope,
        method=payload.method,
        token=ownership.new_token(),
        created_by=current_user.id,
    )
    db.add(v)
    db.flush()
    _audit(db, org_id, current_user.id, "target_verification_started", v)
    db.commit()
    db.refresh(v)
    return _out(v)


@router.post("/{verification_id}/check", response_model=VerificationOut)
def check_verification(
    verification_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(require_role("admin", "analyst")),
):
    v = _get_owned(db, org_id, verification_id)
    result = ownership.run_check(v.scope, v.method, v.token)
    now = datetime.now(timezone.utc)
    v.last_checked_at = now
    v.last_check_detail = result.detail
    if result.ok:
        v.verified_at = now
    _audit(
        db, org_id, current_user.id,
        "target_verification_succeeded" if result.ok else "target_verification_failed",
        v, {"detail": result.detail},
    )
    db.commit()
    db.refresh(v)
    return _out(v)


@router.delete("/{verification_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_verification(
    verification_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(require_role("admin")),
):
    v = _get_owned(db, org_id, verification_id)
    _audit(db, org_id, current_user.id, "target_verification_revoked", v)
    db.delete(v)
    db.commit()
