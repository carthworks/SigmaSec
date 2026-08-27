import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from passlib.context import CryptContext  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import Org, User, UserRole  # noqa: E402

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def seed():
    db = SessionLocal()
    try:
        existing = db.query(Org).filter((Org.slug == "SS") | (Org.slug == "CS")).first()
        if existing:
            print("Already seeded — skipping.")
            return

        org = Org(name="SigmaSec", slug="SS", is_active=True)
        db.add(org)
        db.flush()

        admin = User(
            org_id=org.id,
            email="admin@sigmasec.com",
            hashed_password=pwd_context.hash("Admin@12345!"),
            full_name="SigmaSec Admin",
            role=UserRole.admin,
            is_active=True,
            is_verified=True,
        )
        db.add(admin)

        analyst = User(
            org_id=org.id,
            email="analyst@sigmasec.com",
            hashed_password=pwd_context.hash("Analyst@12345!"),
            full_name="SigmaSec Analyst",
            role=UserRole.analyst,
            is_active=True,
            is_verified=True,
        )
        db.add(analyst)

        db.commit()
        print("Seeded successfully:")
        print("  Org    : SigmaSec (slug=SS)")
        print("  Admin  : admin@sigmasec.com / Admin@12345!")
        print("  Analyst: analyst@sigmasec.com / Analyst@12345!")

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
