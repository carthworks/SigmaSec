# backend/app/routers/compliance.py

import uuid
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_user_org_id
from app.database import get_db
from app.models import Finding, FindingStatus, User
from app.compliance.mapper import compute_compliance_summary, map_finding_to_controls, FRAMEWORKS

router = APIRouter(prefix="/compliance", tags=["compliance"])


@router.get("/summary")
def get_compliance_summary(
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns framework readiness scores and control status breakdowns across SOC 2, PCI-DSS, ISO 27001, and NIST.
    """
    active_findings = (
        db.query(Finding)
        .filter(
            Finding.org_id == org_id,
            Finding.status != FindingStatus.fixed,
            Finding.status != FindingStatus.false_positive,
            Finding.status != FindingStatus.accepted_risk,
        )
        .all()
    )

    summary = compute_compliance_summary(active_findings)
    return {
        "org_id": str(org_id),
        "total_active_findings": len(active_findings),
        "frameworks": summary,
    }


@router.get("/mapping")
def get_compliance_mapping(
    framework: str = Query("soc2", description="soc2 | pci_dss | iso_27001 | nist_800_53"),
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns granular finding-to-control audit mappings for a specific regulatory framework.
    """
    if framework not in FRAMEWORKS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported framework '{framework}'. Valid frameworks: {list(FRAMEWORKS.keys())}",
        )

    fw_info = FRAMEWORKS[framework]
    findings = (
        db.query(Finding)
        .filter(
            Finding.org_id == org_id,
            Finding.status != FindingStatus.fixed,
            Finding.status != FindingStatus.false_positive,
            Finding.status != FindingStatus.accepted_risk,
        )
        .all()
    )

    mapped_results = []
    for f in findings:
        mapped_controls = map_finding_to_controls(f).get(framework, [])
        if mapped_controls:
            sev_attr = getattr(f, "ai_severity_override", None) or getattr(f, "severity", "info")
            sev = (sev_attr.value if hasattr(sev_attr, "value") else str(sev_attr or "info")).lower().strip()
            
            mapped_results.append({
                "finding_id": str(f.id),
                "title": f.title,
                "tool": f.tool,
                "severity": sev,
                "cve_id": f.cve_id,
                "url": f.url,
                "controls": mapped_controls,
            })

    return {
        "framework_id": framework,
        "framework_name": fw_info["name"],
        "total_mapped_findings": len(mapped_results),
        "mappings": mapped_results,
    }
