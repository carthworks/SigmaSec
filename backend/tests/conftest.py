"""
Test harness shared by all backend tests.

- Refuses to run against a database whose name doesn't contain "test", so a
  mis-set DATABASE_URL can never wipe real data.
- Session start: drop and recreate the public schema, then build it with
  `alembic upgrade head` (so every run also proves the migrations work).
- Before each test module: empty every table, so modules can't leak state into
  each other (fixed slugs/emails, leftovers from a failed cleanup).
"""

import os
from urllib.parse import urlsplit

import pytest

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
if not os.environ.get("ENCRYPTION_KEY"):
    # Fresh key per run; no key material is committed to the repo.
    from cryptography.fernet import Fernet

    os.environ["ENCRYPTION_KEY"] = Fernet.generate_key().decode()


def _require_test_database() -> str:
    url = os.environ.get("DATABASE_URL", "")
    name = urlsplit(url).path.lstrip("/")
    if not url or "test" not in name.lower():
        pytest.exit(
            f"Refusing to run: DATABASE_URL must point to a database whose name contains 'test' "
            f"(got '{name or 'unset'}'). Tests reset the schema.",
            returncode=2,
        )
    return url


@pytest.fixture(scope="session", autouse=True)
def _fresh_schema():
    url = _require_test_database()
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, text

    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    engine.dispose()

    cfg = Config(os.path.join(os.path.dirname(os.path.dirname(__file__)), "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(scope="module", autouse=True)
def _empty_tables(_fresh_schema):
    from sqlalchemy import text

    from app.database import engine

    with engine.begin() as conn:
        tables = [
            r[0] for r in conn.execute(text(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'alembic_version'"
            ))
        ]
        if tables:
            conn.execute(text("TRUNCATE " + ", ".join(f'"{t}"' for t in tables) + " RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


@pytest.fixture
def setup_db():
    """A real database session for tests that call save_findings() directly."""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


@pytest.fixture
def create_parents():
    return _create_parents


def _create_parents(db, org_id, asset_id, *scan_ids):
    """Create the org, asset and scans that findings reference (foreign keys)."""
    import uuid as _uuid

    from app.models import Asset, AssetType, Org, Scan, ScanStatus

    db.add(Org(id=_uuid.UUID(str(org_id)), name="Test org", slug=f"t-{str(org_id)[:12]}"))
    db.flush()
    db.add(Asset(id=_uuid.UUID(str(asset_id)), org_id=_uuid.UUID(str(org_id)), name="repo",
                 target="https://github.com/acme/app.git", asset_type=AssetType.git_repo))
    db.flush()
    for sid in scan_ids:
        db.add(Scan(id=_uuid.UUID(str(sid)), org_id=_uuid.UUID(str(org_id)), asset_id=_uuid.UUID(str(asset_id)),
                    target="https://github.com/acme/app.git", scan_types=["opengrep"], status=ScanStatus.complete))
    db.commit()
