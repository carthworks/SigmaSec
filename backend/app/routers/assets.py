import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_user_org_id, require_role
from app.database import get_db
from app.models import Asset, AssetType, User, Scan, Finding
from app.schemas.asset import AssetIn, AssetOut, AssetUpdate, AssetBulkUpdateItem
from app.schemas.finding import FindingOut

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    payload: AssetIn,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(require_role("admin", "analyst")),
):
    """
    Create a new asset inside the current organization.
    Checks that the asset target does not already exist.
    """
    # Check if target already exists in the organization
    existing = (
        db.query(Asset)
        .filter(Asset.org_id == org_id, Asset.target == payload.target)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Asset target '{payload.target}' already exists in organization",
        )

    # Validate asset_type
    try:
        asset_type = AssetType(payload.asset_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid asset_type '{payload.asset_type}'. Valid: url, docker_image, git_repo",
        )

    asset = Asset(
        org_id=org_id,
        name=payload.name,
        target=payload.target,
        asset_type=asset_type,
        asset_weight=payload.asset_weight,
        owner_email=payload.owner_email,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("")
def list_assets(
    count_only: bool = False,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
):
    """List all assets belonging to the current organization or return total count."""
    if count_only:
        count = db.query(Asset).filter(Asset.org_id == org_id).count()
        return {"count": count}
    
    assets = db.query(Asset).filter(Asset.org_id == org_id).all()
    result = []
    for a in assets:
        # Get last scan
        last_scan = (
            db.query(Scan)
            .filter(Scan.asset_id == a.id)
            .order_by(Scan.created_at.desc())
            .first()
        )
        last_scan_str = last_scan.created_at.isoformat() if last_scan else None
        
        # Get findings count by severity
        findings = db.query(Finding).filter(Finding.asset_id == a.id).all()
        findings_count = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for f in findings:
            sev_field = f.ai_severity_override or f.severity
            sev = sev_field.value if hasattr(sev_field, "value") else str(sev_field)
            if sev in findings_count:
                findings_count[sev] += 1
                
        asset_data = AssetOut.model_validate(a)
        asset_data.last_scan = last_scan_str
        asset_data.findings_count = findings_count
        result.append(asset_data)
    return result


@router.get("/{asset_id}/findings", response_model=List[FindingOut])
def get_asset_findings(
    asset_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
):
    """Get all findings associated with a specific asset."""
    asset = (
        db.query(Asset)
        .filter(Asset.id == asset_id)
        .first()
    )
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )
    if asset.org_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: asset belongs to another organization",
        )
    return db.query(Finding).filter(Finding.asset_id == asset_id).all()


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(
    asset_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
):
    """Retrieve details of a specific asset. Enforces org isolation."""
    asset = (
        db.query(Asset)
        .filter(Asset.id == asset_id)
        .first()
    )
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )
    if asset.org_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: asset belongs to another organization",
        )
    return asset


@router.patch("/{asset_id}", response_model=AssetOut)
def patch_asset(
    asset_id: uuid.UUID,
    payload: AssetUpdate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(require_role("admin", "analyst")),
):
    """
    Update weight of a specific asset.
    Admin/analyst only. Enforces org isolation.
    """
    asset = (
        db.query(Asset)
        .filter(Asset.id == asset_id)
        .first()
    )
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )
    if asset.org_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: asset belongs to another organization",
        )

    asset.asset_weight = payload.asset_weight
    db.commit()
    db.refresh(asset)
    return asset


@router.post("/bulk", status_code=status.HTTP_200_OK)
def bulk_update_assets(
    payload: List[AssetBulkUpdateItem],
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(require_role("admin", "analyst")),
):
    """
    Bulk update owner_email for assets.
    Matches asset by 'id' (UUID) or by 'target' string.
    Only assets belonging to the current user's organization are updated.
    """
    updated_count = 0
    errors = []
    
    for idx, item in enumerate(payload):
        asset = None
        # If id is provided, lookup by id
        if item.id:
            try:
                asset_uuid = uuid.UUID(item.id)
                asset = db.query(Asset).filter(Asset.id == asset_uuid, Asset.org_id == org_id).first()
            except ValueError:
                errors.append(f"Row {idx + 1}: Invalid UUID format '{item.id}'")
                continue
        
        # If asset not found by id but target is provided, or if id was not provided but target is
        if not asset and item.target:
            asset = db.query(Asset).filter(Asset.target == item.target, Asset.org_id == org_id).first()
            
        if not asset:
            identifier = item.id or item.target or f"Row {idx + 1}"
            errors.append(f"Asset '{identifier}' not found in organization")
            continue
            
        asset.owner_email = item.owner_email
        updated_count += 1
        
    db.commit()
    return {"success": True, "updated_count": updated_count, "errors": errors}
