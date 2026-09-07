import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from alembic import command
from alembic.config import Config
from app.database import check_db_connection, engine
from app.routers import (
    admin,
    assets,
    auth,
    compliance,
    dashboard,
    executive,
    findings,
    orgs,
    scans,
    users,
)

migration_status = "Not started"
migration_error = None
db_check_info = ""

# Global rate limiter (used by routers via import)
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="SigmaSec Security Platform",
    version="0.1.0",
    description="AI-augmented security vulnerability scanning platform",
)

# Attach limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        # Vercel production deployment — set VERCEL_FRONTEND_URL in backend .env
        *([os.getenv("VERCEL_FRONTEND_URL")] if os.getenv("VERCEL_FRONTEND_URL") else []),
    ],
    # Allow local dev origins + all *.vercel.app preview deployment URLs
    allow_origin_regex=r"(http://(localhost|127\.0\.0\.1)(:\d+)?|https://[a-zA-Z0-9\-]+\.vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(orgs.router)
app.include_router(users.router)
app.include_router(scans.router)
app.include_router(assets.router)
app.include_router(findings.router)
app.include_router(admin.router)
app.include_router(executive.router)
app.include_router(dashboard.router)
app.include_router(compliance.router)



@app.on_event("startup")
def on_startup():
    global migration_status, migration_error, db_check_info
    try:
        from sqlalchemy import text

        # Ensure new AI columns exist on findings table
        try:
            with engine.begin() as conn:
                # conn.execute(text("DROP TABLE IF EXISTS audit_logs CASCADE"))
                conn.execute(
                    text(
                        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_why_now TEXT"
                    )
                )
                conn.execute(
                    text(
                        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_remediation_structured JSONB"
                    )
                )
                conn.execute(
                    text("ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_patch JSONB")
                )
                conn.execute(
                    text(
                        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_blockers JSONB"
                    )
                )
                conn.execute(
                    text(
                        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_breaking_change_risk VARCHAR(20)"
                    )
                )
                conn.execute(
                    text(
                        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_confidence FLOAT"
                    )
                )
                conn.execute(
                    text(
                        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_insufficient_context JSONB"
                    )
                )
                conn.execute(
                    text(
                        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS reachability_context JSONB"
                    )
                )
                conn.execute(
                    text(
                        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64)"
                    )
                )
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_findings_fingerprint ON findings (fingerprint)"
                    )
                )
                print("Ensured new AI and fingerprint finding columns exist in DB.")
        except Exception as e_db:
            print(f"DB schema migration check: {e_db}")


        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        ini_path = os.path.join(base_dir, "alembic.ini")
        if os.path.exists(ini_path):
            alembic_cfg = Config(ini_path)
            alembic_cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
            command.upgrade(alembic_cfg, "head")
            migration_status = "Applied successfully"
            print("Migrations applied successfully on startup.")
        else:
            migration_status = f"alembic.ini not found at {ini_path}"
            print(f"Programmatic migrations: alembic.ini not found at {ini_path}")

        # Seed default org and users (admin@sigmasec.com / analyst@sigmasec.com)
        try:
            from app.seed import seed
            seed()
        except Exception as e_seed:
            print(f"Startup seeding error: {e_seed}")

    except Exception as e:
        migration_status = "Failed"
        migration_error = str(e)
        print(f"Programmatic migrations failed: {e}")


@app.get("/test-export-debug")
def test_export_debug():
    import traceback
    import uuid

    from app.database import SessionLocal
    from app.models import Finding, Scan
    from app.reports.pdf import ScanReport

    db = SessionLocal()
    scan_id = uuid.UUID("65bc2c43-48cd-422e-a139-272be36e617d")
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            return {"error": "Scan not found"}
        findings = db.query(Finding).filter(Finding.scan_id == scan_id).all()
        if not scan.exec_summary:
            from app.tasks.scan_tasks import generate_exec_summary_if_needed

            generate_exec_summary_if_needed(db, str(scan_id))
            db.refresh(scan)
        report = ScanReport(scan, findings, template="technical")
        pdf_bytes = report.generate()
        return {"status": "success", "pdf_bytes_length": len(pdf_bytes)}
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc(),
        }
    finally:
        db.close()


@app.get("/restart-backend")
def restart_backend():
    import os

    print("Restarting backend container programmatically...")
    os._exit(0)


@app.get("/health", tags=["system"])
def health_check():
    db_ok = check_db_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "version": app.version,
        "db_ok": db_ok,
        "migration_status": migration_status,
        "migration_error": migration_error,
        "db_check_info": db_check_info,
    }
