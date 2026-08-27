# test_agent.py
import uuid
import sys

from app.database import SessionLocal
from app.ai.agent import SecurityAgent

def main():
    db = SessionLocal()
    scan_id_str = "65bc2c43-48cd-422e-a139-272be36e617d"
    
    # Fallback to any completed scan if this ID is not in DB
    from app.models import Scan
    scan = db.query(Scan).filter(Scan.id == uuid.UUID(scan_id_str)).first()
    if not scan:
        scan = db.query(Scan).order_by(Scan.created_at.desc()).first()
        if not scan:
            print("No scans found in database.")
            sys.exit(1)
        scan_id_str = str(scan.id)
        
    scan_id = uuid.UUID(scan_id_str)
    print(f"Testing SecurityAgent against Scan ID: {scan_id}...")
    
    try:
        agent = SecurityAgent(db, scan_id)
        print("Running agent query...")
        answer, citations = agent.run_agent("What should I fix this sprint?")
        print("\n=== AGENT RESPONSE ===")
        print(f"Answer: {answer}")
        print(f"Citations: {citations}")
        print("======================\n")
    except Exception as e:
        import traceback
        print("\n=== AGENT ERROR ===")
        traceback.print_exc()
        print("===================\n")
    finally:
        db.close()

if __name__ == "__main__":
    main()
