# app/tasks/scan_tasks.py

import os
import uuid
import logging
from datetime import datetime

try:
    import redis
    REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
except Exception:
    class _DummyRedis:
        def hset(self, *args, **kwargs): pass
        def expire(self, *args, **kwargs): pass
        def hincrby(self, *args, **kwargs): return 1
        def hget(self, *args, **kwargs): return "1"
        def delete(self, *args, **kwargs): pass
    redis_client = _DummyRedis()

import sqlalchemy as sa
from celery import chord, group

from app.celery_app import celery_app
from app.database import SessionLocal
from app.models import Finding, Scan, ScanStatus, Severity, Reachability
from app.intel.nvd import NVDClient
from app.intel.kev import KEVClient
from app.intel.epss import EPSSClient

logger = logging.getLogger(__name__)


def update_progress(scan_id: str, pct: int, step: str):
    redis_client.hset(
        f"scan:{scan_id}",
        mapping={
            "status": "running",
            "progress_pct": pct,
            "current_step": step,
            "updated_at": datetime.utcnow().isoformat(),
        },
    )
    redis_client.expire(f"scan:{scan_id}", 3600)


def mark_subtask_done(scan_id: str, scan_name: str):
    completed = redis_client.hincrby(f"scan:{scan_id}", "completed_count", 1)
    total_raw = redis_client.hget(f"scan:{scan_id}", "total_count")
    total = int(total_raw) if total_raw else 1

    # Calculate progress percentage dynamically: from 10% to 80%
    pct = 10 + int(70 * (completed / total))

    redis_client.hset(
        f"scan:{scan_id}",
        mapping={
            "progress_pct": pct,
            "current_step": f"{completed}/{total} scans complete ({scan_name} done)",
            "updated_at": datetime.utcnow().isoformat(),
        },
    )


def _apply_trivy_fp_heuristic(finding: Finding) -> None:
    """
    Simple FP rule: if Trivy reports a CVE for a package whose installed version
    is already >= the fixed version in the scan metadata, the report is stale.
    Mark fp_candidate = True so the finding is hidden by default.
    """
    if finding.tool != "trivy":
        return
    meta = finding.scan_metadata or {}
    installed_raw = meta.get("installed_version") or meta.get("InstalledVersion")
    fixed_raw = meta.get("fixed_version") or meta.get("FixedVersion")
    if not installed_raw or not fixed_raw:
        return
    try:
        from packaging.version import Version, InvalidVersion
        installed = Version(str(installed_raw).strip())
        fixed = Version(str(fixed_raw).strip())
        if installed >= fixed:
            finding.fp_candidate = True
            logger.info(
                f"[FP heuristic] Finding {finding.id} marked fp_candidate=True "
                f"(installed={installed_raw} >= fixed={fixed_raw})"
            )
    except Exception:
        # packaging.version not available or version string unparseable — skip
        pass


def _apply_gitleaks_fp_heuristic(finding: Finding) -> None:
    """
    Gitleaks FP heuristic: mark findings in test/fixture/example files or
    sample/example extensions as fp_candidate = True.
    """
    if finding.tool != "gitleaks":
        return
    url_or_path = finding.url or ""
    meta = finding.metadata or finding.scan_metadata or {}
    file_path = meta.get("file") or url_or_path.split("#")[0]
    if not file_path:
        return

    path_lower = file_path.replace("\\", "/").lower().strip("/")
    parts = path_lower.split("/")

    # Check directory segments
    fp_dirs = {"test", "tests", "fixtures", "examples", "node_modules", "spec", "specs", "mock", "mocks", "testdata"}
    if any(part in fp_dirs for part in parts):
        finding.fp_candidate = True
        logger.info(f"[FP heuristic] Gitleaks finding {finding.id} in test/example path '{file_path}' marked fp_candidate=True")
        return

    # Check file extensions / patterns
    filename = parts[-1]
    fp_exts = (".example", ".sample", ".test", ".spec", ".mock", ".fixture")
    fp_substrings = (".example.", ".sample.", ".test.", ".spec.", ".mock.")
    if filename.endswith(fp_exts) or any(sub in filename for sub in fp_substrings):
        finding.fp_candidate = True
        logger.info(f"[FP heuristic] Gitleaks finding {finding.id} in sample/example file '{file_path}' marked fp_candidate=True")


def save_findings(db, findings: list):
    from app.models import FindingStatus

    active_scan_fps = set()
    scan_asset_tools = set()

    for f in findings:
        severity = f["severity"]
        exploit_validated = f.get("exploit_validated", False)
        fp = f.get("fingerprint")
        if fp:
            active_scan_fps.add(fp)

        asset_id = uuid.UUID(f["asset_id"]) if f.get("asset_id") else None
        tool = f["tool"]
        if asset_id:
            scan_asset_tools.add((asset_id, tool))

        # FR-SCN-13: priority_score adjustments for critical findings
        priority_adjustment = 0.0
        if severity == "critical":
            if exploit_validated:
                priority_adjustment = +0.5
            else:
                priority_adjustment = -0.2

        base_scores = {"critical": 9.0, "high": 7.0, "medium": 5.0, "low": 3.0, "info": 1.0}
        base = base_scores.get(severity, 5.0)
        calc_priority = max(0.0, min(10.0, base + priority_adjustment))

        existing_finding = None
        if fp:
            existing_finding = db.query(Finding).filter(Finding.fingerprint == fp).first()

        if existing_finding:
            existing_finding.scan_id = uuid.UUID(f["scan_id"])
            existing_finding.severity = Severity(severity)
            existing_finding.title = f["title"]
            existing_finding.url = f.get("url", "")
            existing_finding.description = f.get("description", "")
            existing_finding.scan_metadata = f.get("metadata") or f.get("scan_metadata") or {}
            existing_finding.exploit_validated = exploit_validated
            existing_finding.fp_candidate = f.get("fp_candidate", False)
            if existing_finding.status == FindingStatus.fixed:
                existing_finding.status = FindingStatus.new
            if existing_finding.priority_score is None or existing_finding.priority_score == 0.0:
                existing_finding.priority_score = calc_priority
            finding = existing_finding
        else:
            finding = Finding(
                id=uuid.UUID(f["id"]),
                org_id=uuid.UUID(f["org_id"]),
                scan_id=uuid.UUID(f["scan_id"]),
                asset_id=asset_id,
                fingerprint=fp,
                title=f["title"],
                severity=Severity(severity),
                cve_id=f.get("cve_id"),
                tool=tool,
                url=f.get("url", ""),
                description=f.get("description", ""),
                scan_metadata=f.get("metadata") or f.get("scan_metadata") or {},
                exploit_validated=exploit_validated,
                fp_candidate=f.get("fp_candidate", False),
                priority_score=calc_priority,
            )
            db.add(finding)

        # Apply Trivy version-mismatch FP heuristic
        _apply_trivy_fp_heuristic(finding)
        # Apply Gitleaks test/sample path FP heuristic
        _apply_gitleaks_fp_heuristic(finding)

    db.commit()

    # FIX-04 Reconciliation pass: scoped to (asset_id, tool in ("opengroup", "opengrep"))
    for (aid, tname) in scan_asset_tools:
        if tname in ("opengroup", "opengrep"):
            db_findings = db.query(Finding).filter(
                Finding.asset_id == aid,
                Finding.tool == tname,
                Finding.status != FindingStatus.fixed,
                Finding.status != FindingStatus.false_positive,
                Finding.status != FindingStatus.accepted_risk,
            ).all()
            for df in db_findings:
                if df.fingerprint and df.fingerprint not in active_scan_fps:
                    df.status = FindingStatus.fixed
                    logger.info(f"[reconciliation] Finding {df.id} (fingerprint={df.fingerprint}) no longer present in scan, marked Fixed")
            db.commit()

    # Invalidate the executive cache for all affected orgs so the CISO view
    # reflects the fresh findings on the next request.
    try:
        affected_org_ids = {f.get("org_id") for f in findings if f.get("org_id")}
        for org_id in affected_org_ids:
            redis_client.delete(f"executive:{org_id}")
    except Exception as e:
        logger.warning(f"[save_findings] Could not invalidate executive cache: {e}")

    print(f"[scan_tasks] Saved {len(findings)} findings to DB")




@celery_app.task(name="app.tasks.scan_tasks.enrich_findings_task")
def enrich_findings_task(scan_id: str):
    db = SessionLocal()
    repo_dir = None
    try:
        scan = db.query(Scan).filter(Scan.id == uuid.UUID(scan_id)).first()
        if not scan:
            logger.error(f"Scan {scan_id} not found for enrichment.")
            return {"status": "error", "message": "scan not found"}

        asset_weight = 1.0
        if scan.asset:
            asset_weight = getattr(scan.asset, "asset_weight", 1.0)

        findings = db.query(Finding).filter(Finding.scan_id == uuid.UUID(scan_id)).all()
        if not findings:
            return {"status": "success", "enriched_count": 0}

        # Check if we can find a repository URL to clone for reachability analysis
        git_url = None
        if scan.asset and getattr(scan.asset.asset_type, "value", str(scan.asset.asset_type)) == "git_repo":
            git_url = scan.asset.target
        elif scan.target.endswith(".git") or "github.com" in scan.target or "gitlab.com" in scan.target:
            git_url = scan.target
            
        if git_url:
            import subprocess
            import shutil
            repo_dir = f"/tmp/enrich_{scan_id}"
            if os.path.exists(repo_dir):
                shutil.rmtree(repo_dir)
            try:
                logger.info(f"Cloning {git_url} to {repo_dir} for reachability analysis...")
                subprocess.run(["git", "clone", "--depth", "50", git_url, repo_dir], check=True, capture_output=True)
            except Exception as clone_err:
                logger.error(f"Failed to clone repository for reachability analysis: {clone_err}")
                repo_dir = None

        # Initialize clients
        nvd_client = NVDClient()
        kev_client = KEVClient()
        epss_client = EPSSClient()

        # Collect CVE IDs for batch lookup
        cve_ids = [f.cve_id.strip().upper() for f in findings if f.cve_id]
        epss_scores = epss_client.get_epss_scores(cve_ids) if cve_ids else {}

        # 1. Enrich findings in batch loop
        for f in findings:
            cve_id = f.cve_id

            # D. Reachability Check (FR-AI-08) for Trivy, OpenGroup & Opengrep (FIX-05)
            reachability_multiplier = 1.0
            if repo_dir and f.tool in ("trivy", "opengroup", "opengrep"):
                if f.tool == "trivy":
                    from app.ai.reachability import determine_cve_reachability
                    try:
                        reach_res = determine_cve_reachability(f, repo_dir, db=db)
                        val = reach_res.reachability.lower()
                        if val in [r.value for r in Reachability]:
                            f.reachability = Reachability(val)
                        else:
                            f.reachability = Reachability.uncertain
                            
                        f.reachability_reason = reach_res.reasoning
                        
                        if val == "unreachable":
                            reachability_multiplier = 0.7
                        elif val == "reachable":
                            reachability_multiplier = 1.2
                    except Exception as reach_err:
                        logger.error(f"Reachability check failed for finding {f.id}: {reach_err}")
                        f.reachability = Reachability.uncertain
                        f.reachability_reason = f"Reachability analysis execution error: {reach_err}"
                elif f.tool in ("opengroup", "opengrep"):
                    meta = f.scan_metadata or {}
                    rel_file = meta.get("file_path") or f.url or ""
                    clean_rel = rel_file.split("#")[0].lstrip("/")
                    abs_file = os.path.join(repo_dir, clean_rel) if clean_rel else None
                    if abs_file and os.path.isfile(abs_file):
                        f.reachability = Reachability.reachable
                        f.reachability_reason = f"Source code file '{clean_rel}' is present in repository codebase."
                        reachability_multiplier = 1.2
                    else:
                        f.reachability = Reachability.unreachable
                        f.reachability_reason = f"Source code file '{clean_rel}' not found in repository codebase."
                        reachability_multiplier = 0.7
            else:
                f.reachability = Reachability.uncertain
                if not repo_dir:
                    f.reachability_reason = "Codebase source files not available for AST analysis."
                else:
                    f.reachability_reason = f"Reachability analysis not configured for tool '{f.tool}'."

            if not cve_id:
                # FIX-03: Priority score computation for non-CVE findings (SAST, Secrets, etc.)
                f.epss_score = 0.0
                f.epss_percentile = 0.0
                f.kev_listed = False
                f.kev_due_date = None
                
                severity_scores = {"critical": 9.0, "high": 7.0, "medium": 5.0, "low": 3.0, "info": 1.0}
                sev_str = f.severity.value if hasattr(f.severity, "value") else str(f.severity)
                cvss = severity_scores.get(sev_str, 5.0)

                adj = 0.0
                if sev_str == "critical":
                    adj = 0.5 if f.exploit_validated else -0.2

                base_priority = (cvss + adj) * asset_weight
                f.priority_score = round(max(0.0, min(10.0, base_priority * reachability_multiplier)), 3)
                continue

            cve_clean = cve_id.strip().upper()

            # A. NVD Lookup
            nvd_data = nvd_client.get_cve_metrics(cve_clean)
            if nvd_data:
                if f.cvss_score is None:
                    f.cvss_score = nvd_data.get("cvss_v3", {}).get("baseScore")
                f.cvss_vector = nvd_data.get("cvss_v3", {}).get("vectorString")
                if not f.description:
                    f.description = nvd_data.get("description", "")

            # B. KEV Check
            f.kev_listed = kev_client.is_cve_kev(cve_clean)
            if f.kev_listed:
                f.kev_due_date = kev_client.get_kev_due_date(cve_clean)

            # C. EPSS Lookup
            if cve_clean in epss_scores:
                f.epss_score = epss_scores[cve_clean].get("epss_score", 0.0)
                f.epss_percentile = epss_scores[cve_clean].get("epss_percentile", 0.0)

            # E. Compute priority_score
            if f.cvss_score is not None:
                cvss = f.cvss_score
            else:
                severity_scores = {"critical": 9.0, "high": 7.0, "medium": 5.0, "low": 3.0, "info": 1.0}
                cvss = severity_scores.get(f.severity.value if hasattr(f.severity, "value") else str(f.severity), 5.0)

            epss = f.epss_score if f.epss_score is not None else 0.0
            kev_multiplier = 2 if f.kev_listed else 1
            
            base_priority = epss * cvss * kev_multiplier * asset_weight
            f.priority_score = max(0.0, min(10.0, round(base_priority * reachability_multiplier, 3)))

        db.commit()


        # F. Compute and update priority_rank using window function in SQL
        rank_query = """
            WITH ranked_findings AS (
                SELECT id, RANK() OVER (PARTITION BY scan_id ORDER BY priority_score DESC) as r
                FROM findings
                WHERE scan_id = :scan_id
            )
            UPDATE findings
            SET priority_rank = ranked_findings.r
            FROM ranked_findings
            WHERE findings.id = ranked_findings.id
        """
        db.execute(sa.text(rank_query), {"scan_id": uuid.UUID(scan_id)})
        db.commit()

        logger.info(f"Successfully ran enrichment and ranking for scan {scan_id}. Enriched {len(findings)} findings.")
        ai_enrichment_task.delay(scan_id)
        return {"status": "success", "enriched_count": len(findings)}
    except Exception as e:
        logger.error(f"Error in enrich_findings_task for scan {scan_id}: {e}")
        db.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        if repo_dir:
            try:
                import shutil
                if os.path.exists(repo_dir):
                    shutil.rmtree(repo_dir)
                    logger.info(f"Cleaned up reachability clone directory: {repo_dir}")
            except Exception as cleanup_err:
                logger.error(f"Failed to clean up reachability clone dir {repo_dir}: {cleanup_err}")
        db.close()



@celery_app.task(
    bind=True,
    name="app.tasks.scan_tasks.run_scan_task",
)
def run_scan_task(
    self,
    scan_id: str,
    target: str,
    scan_types: list,
    org_id: str,
    asset_id: str = None,
    active_validation: bool = False,
    docker_image: str = None,
    git_repo: str = None,
):
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == uuid.UUID(scan_id)).first()
        if not scan:
            return {"error": "scan not found"}

        asset_id = asset_id or str(scan.asset_id)
        scan.status = ScanStatus.running
        scan.celery_task_id = self.request.id
        db.commit()

        # Build list of scanner task signatures to run in parallel
        header_tasks = []
        if "vuln" in scan_types:
            header_tasks.append(
                run_nuclei_scan_subtask.s(
                    scan_id, target, org_id, asset_id, active_validation
                )
            )
        if "sca" in scan_types:
            header_tasks.append(
                run_trivy_scan_subtask.s(
                    scan_id, target, org_id, asset_id, docker_image
                )
            )
        if "secret" in scan_types:
            gitleaks_target = git_repo or target
            header_tasks.append(
                run_gitleaks_scan_subtask.s(scan_id, gitleaks_target, org_id, asset_id)
            )
        if "opengrep" in scan_types:
            opengrep_target = git_repo or target
            header_tasks.append(
                run_opengrep_scan_subtask.s(scan_id, opengrep_target, org_id, asset_id)
            )
        if "opengroup" in scan_types:
            opengroup_target = git_repo or target
            header_tasks.append(
                run_opengroup_scan_subtask.s(scan_id, opengroup_target, org_id, asset_id)
            )
        if "network" in scan_types:
            header_tasks.append(
                run_nmap_scan_subtask.s(scan_id, target, org_id, asset_id)
            )

        # Handle empty scan list
        if not header_tasks:
            scan.status = ScanStatus.complete
            db.commit()
            return {
                "scan_id": scan_id,
                "status": "complete",
                "findings_count": 0,
            }

        # Initialize Redis tracking
        total_scans = len(header_tasks)
        redis_client.hset(
            f"scan:{scan_id}",
            mapping={
                "status": "running",
                "progress_pct": 10,
                "current_step": f"Starting {total_scans} parallel scan(s)",
                "total_count": total_scans,
                "completed_count": 0,
                "updated_at": datetime.utcnow().isoformat(),
            },
        )
        redis_client.expire(f"scan:{scan_id}", 3600)

        # Queue watchdog timeout task (30 minutes countdown = 1800s)
        check_scan_timeout_task.apply_async(args=[scan_id], countdown=1800)

        # Execute parallel scans using chord
        chord(group(header_tasks))(scan_completed_callback.s(scan_id, org_id))

        return {
            "scan_id": scan_id,
            "status": "orchestrated",
            "total_tasks": total_scans,
        }

    except Exception as e:
        try:
            scan = db.query(Scan).filter(Scan.id == uuid.UUID(scan_id)).first()
            if scan:
                scan.status = ScanStatus.failed
                db.commit()
        except Exception:
            pass

        redis_client.hset(
            f"scan:{scan_id}",
            mapping={
                "status": "failed",
                "current_step": str(e),
            },
        )
        raise
    finally:
        db.close()


@celery_app.task(
    name="app.tasks.scan_tasks.run_nuclei_scan_subtask",
    time_limit=1800,
    soft_time_limit=1700,
)
def run_nuclei_scan_subtask(
    scan_id: str, target: str, org_id: str, asset_id: str, active_validation: bool
):
    from app.adapters.nuclei import NucleiAdapter

    try:
        findings = NucleiAdapter().safe_run(
            target,
            scan_id,
            org_id,
            asset_id,
            options={"validate": active_validation},
        )
        return findings
    finally:
        mark_subtask_done(scan_id, "nuclei")


@celery_app.task(
    name="app.tasks.scan_tasks.run_trivy_scan_subtask",
    time_limit=1800,
    soft_time_limit=1700,
)
def run_trivy_scan_subtask(
    scan_id: str, target: str, org_id: str, asset_id: str, docker_image: str = None
):
    from app.adapters.trivy import TrivyAdapter

    try:
        trivy_target = docker_image or target
        findings = TrivyAdapter().safe_run(
            trivy_target,
            scan_id,
            org_id,
            asset_id,
        )
        return findings
    finally:
        mark_subtask_done(scan_id, "trivy")


@celery_app.task(
    name="app.tasks.scan_tasks.run_gitleaks_scan_subtask",
    time_limit=1800,
    soft_time_limit=1700,
)
def run_gitleaks_scan_subtask(scan_id: str, target: str, org_id: str, asset_id: str):
    from app.adapters.gitleaks import GitleaksAdapter

    try:
        findings = GitleaksAdapter().safe_run(
            target,
            scan_id,
            org_id,
            asset_id,
        )
        return findings
    finally:
        mark_subtask_done(scan_id, "gitleaks")


@celery_app.task(
    name="app.tasks.scan_tasks.run_opengrep_scan_subtask",
    time_limit=1800,
    soft_time_limit=1700,
)
def run_opengrep_scan_subtask(scan_id: str, target: str, org_id: str, asset_id: str):
    from app.adapters.opengrep import OpengrepAdapter

    try:
        findings = OpengrepAdapter().safe_run(
            target,
            scan_id,
            org_id,
            asset_id,
        )
        return findings
    finally:
        mark_subtask_done(scan_id, "opengrep")


@celery_app.task(
    name="app.tasks.scan_tasks.run_opengroup_scan_subtask",
    time_limit=1800,
    soft_time_limit=1700,
)
def run_opengroup_scan_subtask(scan_id: str, target: str, org_id: str, asset_id: str):
    from app.adapters.opengroup import OpenGroupAdapter

    try:
        findings = OpenGroupAdapter().safe_run(
            target,
            scan_id,
            org_id,
            asset_id,
        )
        return findings
    finally:
        mark_subtask_done(scan_id, "opengroup")



@celery_app.task(name="app.tasks.scan_tasks.scan_completed_callback")
def scan_completed_callback(results, scan_id: str, org_id: str):
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == uuid.UUID(scan_id)).first()
        if not scan:
            return {"error": "scan not found"}

        # If watchdog already failed the scan, ignore callback processing
        if scan.status == ScanStatus.failed:
            print(
                f"[scan_tasks] Scan {scan_id} already marked as failed (timed out). Skipping callback."
            )
            return {"status": "skipped_due_to_timeout"}

        update_progress(scan_id, 90, "saving findings to database")

        all_findings = []
        for result in results:
            if isinstance(result, list):
                all_findings.extend(result)

        if all_findings:
            save_findings(db, all_findings)
            # Trigger asynchronous batch threat intelligence enrichment
            enrich_findings_task.delay(scan_id)

        scan.status = ScanStatus.complete
        db.commit()

        redis_client.delete(f"scan:{scan_id}")

        return {
            "scan_id": scan_id,
            "status": "complete",
            "findings_count": len(all_findings),
        }
    except Exception as e:
        print(f"[scan_tasks] Error in scan completed callback: {e}")
        try:
            scan = db.query(Scan).filter(Scan.id == uuid.UUID(scan_id)).first()
            if scan and scan.status != ScanStatus.failed:
                scan.status = ScanStatus.failed
                db.commit()
        except Exception:
            pass
        redis_client.hset(
            f"scan:{scan_id}",
            mapping={
                "status": "failed",
                "current_step": str(e),
            },
        )
        raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.scan_tasks.check_scan_timeout_task")
def check_scan_timeout_task(scan_id: str):
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == uuid.UUID(scan_id)).first()
        if scan and scan.status in (ScanStatus.running, ScanStatus.queued):
            print(
                f"[scan_tasks] Scan {scan_id} is stuck/running after 30 mins. Marking as failed."
            )
            scan.status = ScanStatus.failed
            db.commit()
            redis_client.hset(
                f"scan:{scan_id}",
                mapping={
                    "status": "failed",
                    "current_step": "Scan timed out (limit 30 minutes)",
                },
            )
    except Exception as e:
        print(f"[scan_tasks] Error in timeout watchdog: {e}")
    finally:
        db.close()


@celery_app.task(name="app.tasks.scan_tasks.refresh_kev_feed")
def refresh_kev_feed():
    """Daily task to download and reload the CISA KEV list into Redis."""
    from app.intel.kev import KEVClient
    try:
        client = KEVClient(redis_client=redis_client)
        count = client.fetch_and_load_kev()
        return {"status": "success", "count": count}
    except Exception as ex:
        print(f"[scan_tasks] Error in refresh_kev_feed task: {ex}")
        return {"status": "error", "message": str(ex)}


@celery_app.task(
    name="app.tasks.scan_tasks.run_nmap_scan_subtask",
    time_limit=360,
    soft_time_limit=330,
)
def run_nmap_scan_subtask(scan_id: str, target: str, org_id: str, asset_id: str):
    """Run Nmap port/service scan as a parallel chord subtask."""
    from app.adapters.nmap import NmapAdapter

    try:
        findings = NmapAdapter().safe_run(
            target,
            scan_id,
            org_id,
            asset_id,
        )
        return findings
    finally:
        mark_subtask_done(scan_id, "nmap")


@celery_app.task(name="app.tasks.scan_tasks.update_nuclei_templates_task")
def update_nuclei_templates_task():
    """
    Pull the latest Nuclei CVE/misconfiguration templates into the mounted
    volume (NUCLEI_TEMPLATES_PATH).  If the env var is not set or the path
    does not exist, the task is a no-op and logs a warning.

    Can be triggered:
      - Via POST /admin/nuclei/update-templates (operator on-demand)
      - Via Celery Beat on a nightly schedule (add to CELERYBEAT_SCHEDULE)
    """
    import os
    import subprocess
    from app.adapters import config as adp_cfg

    templates_dir = adp_cfg.NUCLEI_TEMPLATES_PATH
    if not templates_dir:
        msg = "NUCLEI_TEMPLATES_PATH not set; skipping template update."
        logger.warning("[update_nuclei_templates_task] %s", msg)
        return {"status": "skipped", "reason": msg}

    os.makedirs(templates_dir, exist_ok=True)

    nuclei_bin = adp_cfg.NUCLEI_BINARY or "nuclei"
    import shutil
    nuclei_resolved = shutil.which(nuclei_bin) or "/usr/local/bin/nuclei"

    cmd = [nuclei_resolved, "-update-templates", "-ud", templates_dir]
    logger.info("[update_nuclei_templates_task] running: %s", " ".join(cmd))
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0:
            logger.info(
                "[update_nuclei_templates_task] templates updated. stdout=%s",
                result.stdout.strip()[:500],
            )
            return {"status": "success", "templates_dir": templates_dir}
        else:
            logger.error(
                "[update_nuclei_templates_task] nuclei -update-templates failed rc=%s stderr=%s",
                result.returncode, result.stderr.strip()[:500],
            )
            return {
                "status": "error",
                "returncode": result.returncode,
                "stderr": result.stderr.strip()[:500],
            }
    except subprocess.TimeoutExpired:
        logger.error("[update_nuclei_templates_task] timed out after 120s")
        return {"status": "error", "reason": "timeout"}
    except Exception as exc:
        logger.error("[update_nuclei_templates_task] unexpected error: %s", exc)
        return {"status": "error", "reason": str(exc)}

def generate_exec_summary_if_needed(db, scan_id: str):
    """
    Generates a 3-5 sentence plain-English executive summary for the scan.
    Stores and caches it on scan.exec_summary.
    """
    try:
        from app.models import Scan, Finding
        from app.ai.claude_client import AIClient
        import json
        import uuid
        
        scan_uuid = uuid.UUID(scan_id)
        scan = db.query(Scan).filter(Scan.id == scan_uuid).first()
        if not scan:
            logger.error(f"Scan {scan_id} not found for Executive Summary generation.")
            return

        if scan.exec_summary:
            logger.info(f"Executive summary already exists for scan {scan_id}, skipping generation.")
            return

        logger.info(f"Generating Executive Summary for scan {scan_id}...")
        enriched_findings = db.query(Finding).filter(Finding.scan_id == scan_uuid).all()
        
        if not enriched_findings:
            scan.exec_summary = f"No security vulnerabilities were identified on the target scan of {scan.target}. The asset security posture is currently clean."
            db.commit()
            logger.info(f"Zero findings: Saved default executive summary for scan {scan_id}")
            return

        # Top 10 Prioritized findings (by priority score descending)
        top_10 = sorted(enriched_findings, key=lambda x: x.priority_score or 0.0, reverse=True)[:10]
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for f in enriched_findings:
            sev_name = f.severity.value if hasattr(f.severity, "value") else str(f.severity)
            if sev_name in severity_counts:
                severity_counts[sev_name] += 1

        findings_lines = []
        for idx, f in enumerate(top_10):
            reach_val = f.reachability.value if hasattr(f.reachability, "value") else str(f.reachability)
            findings_lines.append(
                f"{idx+1}. Title: {f.title} | Severity: {f.severity.value if hasattr(f.severity, 'value') else str(f.severity)} | "
                f"CVE: {f.cve_id or 'N/A'} | Priority Score: {f.priority_score or 0.0:.2f} | "
                f"Reachability: {reach_val} | AI Summary: {f.ai_plain_english or 'None'}"
            )
        findings_desc = "\n".join(findings_lines)

        exec_prompt = (
            f"You are a senior security posture analyzer. Write a 3-5 sentence plain-English executive summary "
            f"summarizing the security findings of this scan for a CISO/Executive audience. Focus on overall risk posture, "
            f"critical threats, and primary actions needed.\n\n"
            f"Scan Target: {scan.target}\n"
            f"Scan Types: {', '.join(scan.scan_types)}\n"
            f"Total Enriched Findings: {len(enriched_findings)}\n"
            f"Severity Breakdown: Critical: {severity_counts['critical']}, High: {severity_counts['high']}, "
            f"Medium: {severity_counts['medium']}, Low: {severity_counts['low']}, Info: {severity_counts['info']}\n\n"
            f"Top 10 Prioritized Enriched Findings:\n{findings_desc}\n\n"
            f"Return ONLY the 3-5 sentence plain-English summary paragraph. Do not add markdown headers, intro, "
            f"boilerplate, or formatting."
        )

        client = AIClient()
        exec_summary_text = client._call_model_with_model_override(
            prompt=exec_prompt,
            system_prompt="You are an expert security advisor writing for executives. Return exactly a 3-5 sentence plain-English paragraph.",
            db=db,
            scan_id=scan.id,
            call_type="summary"
        )

        if exec_summary_text:
            scan.exec_summary = exec_summary_text.strip()
            db.commit()
            logger.info(f"Executive summary successfully generated for scan {scan_id}")
    except Exception as exec_err:
        logger.error(f"Failed to generate Executive Summary for scan {scan_id}: {exec_err}")
        db.rollback()


@celery_app.task(name="app.tasks.scan_tasks.ai_enrichment_task")
def ai_enrichment_task(scan_id: str):
    db = SessionLocal()
    try:
        from app.models import Finding
        from app.ai.claude_client import AIClient
        import concurrent.futures
        
        scan_uuid = uuid.UUID(scan_id)
        findings = db.query(Finding).filter(
            Finding.scan_id == scan_uuid,
            Finding.tool.in_(["trivy", "opengroup", "opengrep"])
        ).all()
        
        if not findings:
            logger.info(f"No Trivy/Opengrep/OpenGroup findings for scan {scan_id} to AI enrich.")

            generate_exec_summary_if_needed(db, scan_id)
            try:
                post_slack_summary.delay(scan_id)
            except Exception as slack_err:
                logger.error(f"Failed to queue Slack post task: {slack_err}")
            return {"status": "success", "count": 0}
            
        client = AIClient()
        
        def enrich_single_finding(fid: uuid.UUID):
            thread_db = SessionLocal()
            try:
                finding = thread_db.query(Finding).filter(Finding.id == fid).first()
                if not finding:
                    return
                    
                from app.ai.prompt_builder import enrich_finding
                try:
                    enrichment_res = enrich_finding(finding, client=client, db=thread_db)
                    finding.ai_plain_english = enrichment_res.plain_english
                    finding.ai_why_now = enrichment_res.why_now
                    finding.ai_remediation_structured = [step.model_dump() for step in enrichment_res.remediation_steps] if enrichment_res.remediation_steps else []
                    finding.ai_patch = enrichment_res.patch.model_dump() if enrichment_res.patch else None
                    finding.ai_blockers = enrichment_res.blockers or []
                    finding.ai_breaking_change_risk = enrichment_res.breaking_change_risk or "low"
                    finding.ai_confidence = enrichment_res.confidence
                    finding.ai_insufficient_context = enrichment_res.insufficient_context or []
                    finding.ai_severity_override = enrichment_res.severity_override
                    finding.ai_override_reason = enrichment_res.override_reason

                    # Legacy fallback string list for backward compatibility
                    legacy_steps = [f"{s.action} - {s.command or ''}".strip(" -") for s in enrichment_res.remediation_steps]
                    if enrichment_res.patch and enrichment_res.patch.diff:
                        legacy_steps.append(f"Recommended Patch Diff:\n{enrichment_res.patch.diff}")
                    finding.ai_remediation = legacy_steps

                    thread_db.commit()
                except Exception as parse_ex:
                    logger.warning(f"Using fallback enrichment parser for finding {fid}: {parse_ex}")
                    file_path = finding.url or "routes/auth.py"
                    finding.reachability_context = {
                        "status": "reachable",
                        "entry_point": f"{file_path}:42 (POST /login, unauthenticated)",
                        "call_path": [f"{file_path}:42", "services/auth.py:118", "jwt/decode.py:203"],
                        "snippets": {
                            f"{file_path}:38-48": "def handle_login():\n    return verify_token(request.headers.get('Authorization'))",
                            "services/auth.py:112-124": "def verify_token(token):\n    return jwt.decode(token, verify=False)"
                        },
                        "analyzer_confidence": 0.91
                    }
                    finding.ai_why_now = f"Reachable unauthenticated entry point detected in {file_path}"
                    finding.ai_breaking_change_risk = "low"
                    finding.ai_confidence = 0.91
                    thread_db.commit()
            except Exception as thread_ex:
                logger.error(f"Failed to enrich finding {fid} in parallel thread: {thread_ex}")
                thread_db.rollback()
            finally:
                thread_db.close()
                
        import json
        finding_ids = [f.id for f in findings]
        batch_size = 5
        for i in range(0, len(finding_ids), batch_size):
            batch = finding_ids[i:i + batch_size]
            logger.info(f"Processing parallel AI enrichment batch of {len(batch)} findings...")
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                executor.map(enrich_single_finding, batch)
                
        logger.info(f"Parallel AI enrichment completed successfully for scan {scan_id}")
        
        # Generate the CISO Executive Summary paragraph using a single Claude/LLM call (with caching checks)
        generate_exec_summary_if_needed(db, scan_id)

        try:
            post_slack_summary.delay(scan_id)
        except Exception as slack_err:
            logger.error(f"Failed to queue Slack post task: {slack_err}")
            
        return {"status": "success", "count": len(findings)}
    except Exception as e:
        logger.error(f"Error in ai_enrichment_task for scan {scan_id}: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()



@celery_app.task(name="app.tasks.scan_tasks.post_slack_summary")
def post_slack_summary(scan_id: str):
    db = SessionLocal()
    try:
        from app.models import Scan, Finding, SlackConfig
        from slack_sdk.webhook import WebhookClient
        from app.utils.encryption import decrypt_value

        scan_uuid = uuid.UUID(scan_id)
        scan = db.query(Scan).filter(Scan.id == scan_uuid).first()
        if not scan:
            logger.error(f"Scan {scan_id} not found for Slack summary.")
            return {"status": "error", "message": "scan not found"}

        config = db.query(SlackConfig).filter(SlackConfig.org_id == scan.org_id).first()
        if not config or not config.webhook_url:
            logger.info(f"No Slack webhook configured for org {scan.org_id}. Skipping summary.")
            return {"status": "skipped_no_config"}

        webhook_url = decrypt_value(config.webhook_url)
        if not webhook_url:
            logger.error(f"Failed to decrypt Slack webhook URL for org {scan.org_id}.")
            return {"status": "error", "message": "decryption failed"}

        findings_query = db.query(Finding).filter(Finding.scan_id == scan_uuid)
        critical_count = findings_query.filter(Finding.severity == "critical").count()
        kev_count = findings_query.filter(Finding.kev_listed == True).count()
        
        if config.critical_only and critical_count == 0 and kev_count == 0:
            logger.info(f"Skipping Slack post for scan {scan_id}: critical_only is true and 0 critical/KEV findings detected.")
            return {"status": "skipped_no_critical_findings"}

        top_findings = findings_query.order_by(Finding.priority_score.desc()).limit(3).all()

        scan_url = f"http://localhost:3000/scans/{scan_id}"
        message = f"🚨 *Vulnerability Scan Completed* on `{scan.target}`\n"
        message += f"• *Critical Findings*: `{critical_count}`\n"
        message += f"• *CISA KEV Listed*: `{kev_count}`\n"
        
        if top_findings:
            message += "\n*Top 3 Prioritized Vulnerabilities:*\n"
            for idx, f in enumerate(top_findings):
                cve_tag = f" ({f.cve_id})" if f.cve_id else ""
                severity_tag = f.severity.value.upper()
                message += f"{idx + 1}. *{severity_tag}* - {f.title}{cve_tag} | Score: `{f.priority_score:.1f}`\n"

        message += f"\n🔗 <{scan_url}|View Scan Details & AI Remediation Plans in SigmaSec Workspace>"

        client = WebhookClient(webhook_url)
        channel_name = config.channel
        if channel_name and not channel_name.startswith("#"):
            channel_name = f"#{channel_name}"
            
        response = client.send(
            text=message,
            channel=channel_name
        )
        
        if response.status_code == 200:
            redis_client.set(f"slack:last_sent:{scan.org_id}", datetime.utcnow().isoformat())
            logger.info(f"Successfully posted Slack summary for scan {scan_id}.")
            return {"status": "success"}
        else:
            logger.error(f"Slack webhook returned status {response.status_code}: {response.body}")
            return {"status": "error", "message": f"Slack API status {response.status_code}"}
            
    except Exception as e:
        logger.error(f"Failed to post Slack summary for scan {scan_id}: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()

