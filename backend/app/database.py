# app/database.py

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # checks connection is alive before using it
    pool_size=10,  # max persistent connections
    max_overflow=20,  # extra connections allowed under heavy load
)

SessionLocal = sessionmaker(
    autocommit=False,  # we control when to commit
    autoflush=False,  # we control when to flush
    bind=engine,
)


def get_db():
    """
    FastAPI dependency — yields a DB session per request,
    always closes it after, even if an exception occurs.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """Health check — used by GET /health endpoint (Week 2)."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
