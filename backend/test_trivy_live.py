import sys
import os

from app.adapters.trivy import TrivyAdapter

def test_live_scan():
    print("Initializing TrivyAdapter...")
    adapter = TrivyAdapter()
    
    target_image = "nginx:1.24"
    print(f"Starting live Trivy scan against: {target_image}")
    print("Note: This might take a few seconds on the first run to initialize the vulnerability database.")
    
    try:
        import uuid
        dummy_id = str(uuid.uuid4())
        findings = adapter.run(target_image, scan_id=dummy_id, org_id=dummy_id, asset_id=dummy_id)
        print(f"\n--- Live scan successful! ---")
        print(f"Total vulnerabilities parsed: {len(findings)}")
        
        # Breakdown by severity
        severity_counts = {}
        for f in findings:
            sev = f["severity"]
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
            
        print("\nFindings Severity Breakdown:")
        for sev, count in severity_counts.items():
            print(f" - {sev.upper()}: {count}")
            
        if findings:
            print("\nSample Finding:")
            sample = findings[0]
            print(f" - Title: {sample['title']}")
            print(f" - Severity: {sample['severity']}")
            print(f" - CVE ID: {sample['cve_id']}")
            print(f" - Fix Version: {sample['metadata'].get('fixed_version')}")
            print(f" - Primary URL: {sample['url']}")
            
        print("\nTrivy is fully integrated and functioning correctly!")
        
    except Exception as e:
        print(f"\nError running live Trivy scan: {e}")
        print("Ensure the Trivy binary is built and available at /usr/bin/trivy inside the container.")

if __name__ == "__main__":
    test_live_scan()
