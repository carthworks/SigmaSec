import uuid
from app.database import SessionLocal
from app.models import Scan, Finding

db = SessionLocal()
try:
    scan_id = uuid.UUID("42c2a96e-6cb0-47ba-9105-08c5d7b68d4d")
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        print("Scan not found in database!")
    else:
        print(f"Scan ID: {scan.id}")
        print(f"Target: {scan.target}")
        print(f"Scan Types: {scan.scan_types}")
        print(f"Status: {scan.status}")
        print(f"Celery Task ID: {scan.celery_task_id}")
        print(f"Created At: {scan.created_at}")
        
        findings = db.query(Finding).filter(Finding.scan_id == scan_id).all()
        print(f"Number of findings saved: {len(findings)}")
        for f in findings[:10]:
            print(f"- {f.title} ({f.severity})")
finally:
    db.close()
