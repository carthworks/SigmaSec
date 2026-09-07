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
        org = db.query(Org).filter((Org.slug == "SS") | (Org.slug == "CS")).first()
        if not org:
            org = Org(name="SigmaSec", slug="SS", is_active=True)
            db.add(org)
            db.flush()
            print("Created Org: SigmaSec (slug=SS)")

        # Admin User
        admin = db.query(User).filter(User.email == "admin@sigmasec.com").first()
        if not admin:
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
            print("Created Admin: admin@sigmasec.com / Admin@12345!")
        else:
            admin.hashed_password = pwd_context.hash("Admin@12345!")
            admin.role = UserRole.admin
            admin.is_active = True
            admin.is_verified = True
            print("Updated Admin: admin@sigmasec.com / Admin@12345!")

        # Analyst User
        analyst = db.query(User).filter(User.email == "analyst@sigmasec.com").first()
        if not analyst:
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
            print("Created Analyst: analyst@sigmasec.com / Analyst@12345!")
        else:
            analyst.hashed_password = pwd_context.hash("Analyst@12345!")
            analyst.role = UserRole.analyst
            analyst.is_active = True
            analyst.is_verified = True
            print("Updated Analyst: analyst@sigmasec.com / Analyst@12345!")

        db.commit()
        print("Seeding completed successfully.")

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
