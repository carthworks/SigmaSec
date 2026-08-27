import os
import logging
import time
from datetime import datetime
import httpx
import redis

logger = logging.getLogger(__name__)

class KEVClient:
    def __init__(self, redis_client=None):
        self.redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
        self.redis = redis_client
        if not self.redis:
            try:
                # decode_responses=True ensures we get back string values instead of bytes
                self.redis = redis.from_url(self.redis_url, decode_responses=True)
            except Exception as e:
                logger.error(f"Failed to connect to Redis in KEVClient: {e}")
                self.redis = None
        self.feed_url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

    def fetch_and_load_kev(self) -> int:
        """
        Download the CISA KEV JSON feed and populate it in Redis set `kev:cves`
        and hash `kev:due_dates`. Uses temporary keys and atomic RENAME to avoid race conditions.
        """
        try:
            logger.info("Downloading CISA KEV JSON feed with retries...")
            headers = {
                "User-Agent": "SigmaSec-Scanner/0.1.0 (+https://sigmasec.ai/scanner)"
            }
            
            # Retry mechanism with 3x exponential backoff
            max_retries = 3
            delay = 1.0
            response = None
            for attempt in range(max_retries):
                try:
                    response = httpx.get(self.feed_url, headers=headers, timeout=30.0)
                    response.raise_for_status()
                    break
                except (httpx.HTTPError, httpx.NetworkError) as e:
                    if attempt == max_retries - 1:
                        raise
                    logger.warning(f"KEV download failed (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {delay}s...")
                    time.sleep(delay)
                    delay *= 2

            if not response:
                return 0
                
            data = response.json()
            
            # Save the successful refresh timestamp to Redis
            if self.redis:
                self.redis.set("kev:last_refresh", datetime.utcnow().isoformat() + "Z")
            
            vulnerabilities = data.get("vulnerabilities", [])
            if not vulnerabilities:
                logger.warning("CISA KEV feed returned empty or invalid vulnerabilities list.")
                return 0
                
            cves = []
            due_dates_mapping = {}
            for vuln in vulnerabilities:
                cve_id = vuln.get("cveID")
                if cve_id:
                    cve_clean = cve_id.strip().upper()
                    cves.append(cve_clean)
                    due_date = vuln.get("dueDate")
                    if due_date:
                        due_dates_mapping[cve_clean] = due_date.strip()
                    
            if not cves:
                logger.warning("No CVE IDs found in the KEV feed.")
                return 0
                
            if not self.redis:
                logger.error("Redis client is not available to load KEV feed.")
                return 0
                
            temp_cves_key = "kev:cves:temp"
            target_cves_key = "kev:cves"
            
            temp_dates_key = "kev:due_dates:temp"
            target_dates_key = "kev:due_dates"
            
            # Clear any stale temporary keys
            self.redis.delete(temp_cves_key)
            self.redis.delete(temp_dates_key)
            
            # Pipeline SADD and HSET operations in chunks
            pipeline = self.redis.pipeline()
            chunk_size = 500
            
            # SADD set items
            for i in range(0, len(cves), chunk_size):
                chunk = cves[i:i + chunk_size]
                pipeline.sadd(temp_cves_key, *chunk)
                
            # HSET hash items
            items_to_hash = list(due_dates_mapping.items())
            for i in range(0, len(items_to_hash), chunk_size):
                chunk = dict(items_to_hash[i:i + chunk_size])
                pipeline.hset(temp_dates_key, mapping=chunk)
                
            pipeline.execute()
            
            # Atomically swap temporary keys with target keys
            self.redis.rename(temp_cves_key, target_cves_key)
            if due_dates_mapping:
                self.redis.rename(temp_dates_key, target_dates_key)
            
            count = len(cves)
            logger.info(f"Successfully loaded {count} CVEs and due dates into CISA KEV cache in Redis.")
            return count
            
        except Exception as e:
            logger.error(f"Error fetching/loading CISA KEV feed: {e}")
            return 0

    def is_cve_kev(self, cve_id: str) -> bool:
        """
        Checks if a CVE is listed in CISA KEV cache (O(1) lookup).
        """
        if not cve_id or not self.redis:
            return False
            
        cve_id = cve_id.strip().upper()
        try:
            return bool(self.redis.sismember("kev:cves", cve_id))
        except Exception as e:
            logger.error(f"Error checking KEV status for {cve_id}: {e}")
            return False

    def get_kev_due_date(self, cve_id: str) -> str | None:
        """
        Gets the due date (remediation deadline) for a KEV CVE (O(1) lookup).
        """
        if not cve_id or not self.redis:
            return None
            
        cve_id = cve_id.strip().upper()
        try:
            return self.redis.hget("kev:due_dates", cve_id)
        except Exception as e:
            logger.error(f"Error getting KEV due date for {cve_id}: {e}")
            return None
