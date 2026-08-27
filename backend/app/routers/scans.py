# app/routers/scans.py

import os
import re
import uuid
from datetime import datetime
from typing import List

import redis
import asyncio
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_user_org_id, require_role
from app.database import SessionLocal, get_db

logger = logging.getLogger(__name__)
from app.models import Asset, AssetType, AuditLog, Finding, Scan, ScanStatus, ScanType, User
from app.schemas.scan import ScanIn, ScanOut
from app.tasks.scan_tasks import run_scan_task

router = APIRouter(prefix="/scans", tags=["scans"])


@router.get("/test-export-debug")
def test_export_debug(db: Session = Depends(get_db)):
    import traceback
    scan_id = uuid.UUID("65bc2c43-48cd-422e-a139-272be36e617d")
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            return {"error": "Scan not found"}
        findings = db.query(Finding).filter(Finding.scan_id == scan_id).all()
        
        # Ensure executive summary exists
        if not scan.exec_summary:
            from app.tasks.scan_tasks import generate_exec_summary_if_needed
            generate_exec_summary_if_needed(db, str(scan_id))
            db.refresh(scan)
            
        from app.reports.pdf import ScanReport
        report = ScanReport(scan, findings, template="technical")
        pdf_bytes = report.generate()
        return {"status": "success", "pdf_bytes_length": len(pdf_bytes)}
    except Exception as e:
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}


@router.get("/restart-backend")
def restart_backend():
    import os
    logger.info("Restart requested. Exiting process...")
    # Exit process cleanly to trigger Docker container restart
    os._exit(0)

# Block RFC1918 / loopback / link-local targets
BLOCKED_TARGETS = re.compile(
    r"^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|localhost|0\.0\.0\.0)",
    re.IGNORECASE,
)

SIGMASEC_USER_AGENT = "SigmaSec-Scanner/0.1.0 (+https://sigmasec.ai/scanner)"


def validate_target(target: str):
    """Block scanning internal/private addresses (RFC1918, loopback, link-local)."""
    # Strip scheme for raw IP check
    bare = re.sub(r"^https?://", "", target.strip().lower()).split("/")[0]
    if BLOCKED_TARGETS.match(bare) or bare in ("localhost", "127.0.0.1", "::1"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Scanning internal/private addresses is not allowed (RFC1918/loopback blocked)",
        )


def write_scan_audit_log(
    db: Session,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    target: str,
    scan_id: uuid.UUID,
):
    """Write an audit log entry for every scan creation."""
    try:
        log = AuditLog(
            org_id=org_id,
            user_id=user_id,
            action="create_scan",
            target_type="scan",
            target_id=str(scan_id),
            details={
                "target": target,
                "ts": datetime.utcnow().isoformat(),
            },
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to write scan audit log: {e}")
        db.rollback()


# Rate limiting: enforce 10 POST /scans per hour per IP using limits library
try:
    from limits import storage, strategies, parse
    _rate_limit_storage = storage.MemoryStorage()
    _rate_limit_strategy = strategies.MovingWindowRateLimiter(_rate_limit_storage)
    _SCAN_RATE = parse("10/hour")
    _RATE_LIMIT_AVAILABLE = True
except ImportError:
    _RATE_LIMIT_AVAILABLE = False


def _get_limiter(request: Request):
    """Dependency that enforces 10 POST /scans per hour per source IP (FR-DAY18)."""
    if not _RATE_LIMIT_AVAILABLE:
        return  # graceful degradation if limits not installed

    ip = (request.client.host if request.client else "unknown")
    hit = _rate_limit_strategy.hit(_SCAN_RATE, "create_scan", ip)
    if not hit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded: maximum 10 scans per hour per IP address.",
            headers={"Retry-After": "3600"},
        )


@router.post("", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_scan(
    request: Request,
    payload: ScanIn,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(require_role("admin", "analyst")),
    _rate_check: None = Depends(_get_limiter),
):
    validate_target(payload.target)

    valid_types = {st.value for st in ScanType}
    invalid = set(payload.scan_types) - valid_types
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid scan types: {invalid}. Valid: {valid_types}",
        )

    asset_id = payload.asset_id
    if not asset_id:
        existing_asset = (
            db.query(Asset)
            .filter(Asset.org_id == org_id, Asset.target == payload.target)
            .first()
        )
        if existing_asset:
            asset_id = existing_asset.id
        else:
            a_type = AssetType.url
            if payload.git_repo:
                a_type = AssetType.git_repo
            elif payload.docker_image:
                a_type = AssetType.docker_image

            new_asset = Asset(
                org_id=org_id,
                name=payload.target,
                target=payload.target,
                asset_type=a_type,
                asset_weight=1.0,
            )
            db.add(new_asset)
            db.flush()
            asset_id = new_asset.id

    scan = Scan(
        org_id=org_id,
        asset_id=asset_id,
        target=payload.target,
        scan_types=payload.scan_types,
        status=ScanStatus.queued,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # FR-SCN-13: Write audit log entry
    write_scan_audit_log(
        db=db,
        user_id=current_user.id,
        org_id=org_id,
        target=payload.target,
        scan_id=scan.id,
    )

    task = run_scan_task.delay(
        scan_id=str(scan.id),
        target=payload.target,
        scan_types=payload.scan_types,
        org_id=str(org_id),
        active_validation=payload.active_validation,
        docker_image=payload.docker_image,
        git_repo=payload.git_repo,
    )

    scan.celery_task_id = task.id
    db.commit()

    return scan


@router.get("", response_model=List[ScanOut])
def list_scans(
    days: int = None,
    timeframe: str = None,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Scan).filter(Scan.org_id == org_id)

    num_days = days
    if num_days is None and timeframe:
        if timeframe == "24h":
            num_days = 1
        elif timeframe in ["30d", "30 days", "30"]:
            num_days = 30
        elif timeframe in ["90d", "90 days", "90"]:
            num_days = 90
        elif timeframe == "custom":
            num_days = 180

    if num_days is not None:
        from datetime import datetime, timedelta
        cutoff = datetime.utcnow() - timedelta(days=num_days)
        query = query.filter(Scan.created_at >= cutoff)

    return (
        query
        .order_by(Scan.created_at.desc())
        .all()
    )


@router.get("/{scan_id}", response_model=ScanOut)
def get_scan(
    scan_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found"
        )
    if scan.org_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: scan belongs to another organization"
        )
    return scan


@router.get("/{scan_id}/progress")
def get_scan_progress(
    scan_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
):
    scan = db.query(Scan).filter(Scan.id == scan_id, Scan.org_id == org_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    async def event_generator():
        r = redis.from_url(
            os.environ.get("REDIS_URL", "redis://localhost:6379"),
            decode_responses=True,
        )
        last_log_idx = 0
        
        while True:
            local_db = SessionLocal()
            try:
                current_scan = local_db.query(Scan).filter(Scan.id == scan_id).first()
                if not current_scan:
                    break
                
                status_val = current_scan.status.value
                progress = r.hgetall(f"scan:{scan_id}")
                
                if not progress:
                    pct = 100 if current_scan.status == ScanStatus.complete else 0
                    step = current_scan.status.value
                else:
                    pct = int(progress.get("progress_pct", 0))
                    step = progress.get("current_step", "")
                    status_val = progress.get("status", status_val)
                
                # Fetch new logs from Redis
                new_logs = []
                try:
                    logs_list = r.lrange(f"scan:{scan_id}:logs", last_log_idx, -1)
                    if logs_list:
                        new_logs = logs_list
                        last_log_idx += len(logs_list)
                except Exception as e_logs:
                    logger.error(f"Failed to fetch logs: {e_logs}")
                    
                payload = {
                    "scan_id": str(scan_id),
                    "status": status_val,
                    "progress_pct": pct,
                    "current_step": step,
                    "logs": new_logs,
                }
                
                yield f"data: {json.dumps(payload)}\n\n"
                
                if current_scan.status in (ScanStatus.complete, ScanStatus.failed):
                    # Emit any leftover logs
                    logs_list = r.lrange(f"scan:{scan_id}:logs", last_log_idx, -1)
                    if logs_list:
                        payload["logs"] = logs_list
                        yield f"data: {json.dumps(payload)}\n\n"
                    break
            except Exception as ex:
                logger.error(f"SSE generator error: {str(ex)}")
                break
            finally:
                local_db.close()
                
            await asyncio.sleep(4)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/{scan_id}/findings")
def get_scan_findings(
    scan_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
):
    scan = db.query(Scan).filter(Scan.id == scan_id, Scan.org_id == org_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    findings = (
        db.query(Finding)
        .filter(Finding.scan_id == scan_id, Finding.org_id == org_id)
        .order_by(Finding.created_at.desc())
        .all()
    )
    return findings


from pydantic import BaseModel

class AskRequest(BaseModel):
    question: str

@router.post("/{scan_id}/ask")
def ask_scan_question(
    scan_id: uuid.UUID,
    payload: AskRequest,
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
):
    temp_db = SessionLocal()
    try:
        scan = temp_db.query(Scan).filter(Scan.id == scan_id, Scan.org_id == org_id).first()
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found")
    finally:
        temp_db.close()
        
    from app.ai.agent import SecurityAgent
    
    def sse_generator():
        gen_db = SessionLocal()
        try:
            agent = SecurityAgent(gen_db, scan_id)
            answer, citations = agent.run_agent(payload.question)
            
            # Stream the answer in chunks
            chunk_size = 12
            for i in range(0, len(answer), chunk_size):
                chunk = answer[i:i+chunk_size]
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                
            # Send citations at the end
            yield f"data: {json.dumps({'citations': citations})}\n\n"
        except Exception as e:
            logger.error(f"Error in ask agent generator: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            gen_db.close()
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@router.post("/{scan_id}/export")
def export_scan_report(
    scan_id: uuid.UUID,
    template: str = "executive",
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
):
    """
    POST /scans/{scan_id}/export?template=executive|technical
    Returns PDF report bytes. Stores PDF in MinIO under scans/{org_id}/{scan_id}.pdf.
    """
    from fastapi import Response
    
    if template not in ("executive", "technical"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Template must be 'executive' or 'technical'."
        )

    scan = db.query(Scan).filter(Scan.id == scan_id, Scan.org_id == org_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    if scan.status != ScanStatus.complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report cannot be exported because the scan status is {scan.status.value}. Please wait until the scan is complete."
        )

    # 1. Check MinIO cache first
    from app.utils.storage import get_pdf, upload_pdf
    cached_pdf = get_pdf(str(org_id), str(scan_id), template)
    if cached_pdf:
        return Response(
            content=cached_pdf,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=scan_{scan_id}_{template}_report.pdf"
            }
        )

    # 2. Cache miss: Fetch findings and compile PDF report
    findings = db.query(Finding).filter(
        Finding.scan_id == scan_id,
        Finding.org_id == org_id
    ).all()

    # Ensure executive summary exists
    if not scan.exec_summary:
        from app.tasks.scan_tasks import generate_exec_summary_if_needed
        # This will query and generate it synchronously if not cached on Scan.exec_summary
        generate_exec_summary_if_needed(db, str(scan_id))
        # Refresh scan record from db
        db.refresh(scan)

    from app.reports.pdf import ScanReport
    report = ScanReport(scan, findings, template=template)
    pdf_bytes = report.generate()

    # 3. Save generated PDF to MinIO
    upload_pdf(str(org_id), str(scan_id), pdf_bytes, template)

    # 4. Return PDF bytes
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=scan_{scan_id}_{template}_report.pdf"
        }
    )


@router.post("/{scan_id}/slack")
def post_scan_slack_summary(
    scan_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
):
    """
    POST /scans/{scan_id}/slack
    Manually triggers sending the Slack summary notification for this scan.
    """
    scan = db.query(Scan).filter(Scan.id == scan_id, Scan.org_id == org_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    from app.tasks.scan_tasks import post_slack_summary
    post_slack_summary.delay(str(scan_id))
    return {"status": "success", "message": "Slack summary notification queued successfully."}


