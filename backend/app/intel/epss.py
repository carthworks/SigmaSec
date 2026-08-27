import os
import json
import logging
import time
from datetime import datetime
import httpx
import redis

logger = logging.getLogger(__name__)

class EPSSClient:
    def __init__(self, redis_client=None):
        self.redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
        self.redis = redis_client
        if not self.redis:
            try:
                # decode_responses=True ensures we get back string values instead of bytes
                self.redis = redis.from_url(self.redis_url, decode_responses=True)
            except Exception as e:
                logger.error(f"Failed to connect to Redis in EPSSClient: {e}")
                self.redis = None
        self.base_url = "https://api.first.org/data/v1/epss"

    def get_epss_scores(self, cve_ids: list[str]) -> dict[str, dict]:
        """
        Retrieves EPSS scores and percentiles for a list of CVEs.
        Uses Redis cache first and batches cache misses to FIRST.org API.
        """
        if not cve_ids:
            return {}

        # 1. Clean and deduplicate input CVEs
        cleaned_cves = sorted(list(set(cve.strip().upper() for cve in cve_ids if cve.strip())))
        results = {}
        cache_misses = []

        # 2. Try Redis cache (using MGET for O(N) single-trip check)
        if self.redis:
            try:
                cache_keys = [f"epss:{cve}" for cve in cleaned_cves]
                cached_values = self.redis.mget(cache_keys)
                
                for cve, cached in zip(cleaned_cves, cached_values):
                    if cached:
                        results[cve] = json.loads(cached)
                    else:
                        cache_misses.append(cve)
            except Exception as e:
                logger.warning(f"Error reading from Redis cache in EPSSClient: {e}")
                cache_misses = cleaned_cves.copy()
        else:
            cache_misses = cleaned_cves.copy()

        if not cache_misses:
            return results

        # 3. Batch API calls (up to 100 CVEs per call)
        chunk_size = 100
        for i in range(0, len(cache_misses), chunk_size):
            chunk = cache_misses[i : i + chunk_size]
            cves_param = ",".join(chunk)
            
            try:
                logger.info(f"EPSS Cache miss. Fetching {len(chunk)} CVEs from FIRST.org API with retries...")
                headers = {
                    "User-Agent": "SigmaSec-Scanner/0.1.0 (+https://sigmasec.ai/scanner)"
                }
                
                # Retry mechanism with 3x exponential backoff
                max_retries = 3
                delay = 1.0
                response = None
                for attempt in range(max_retries):
                    try:
                        response = httpx.get(
                            self.base_url,
                            params={"cve": cves_param},
                            headers=headers,
                            timeout=20.0
                        )
                        if response.status_code in (429, 502, 503, 504) or response.status_code >= 500:
                            response.raise_for_status()
                        break
                    except (httpx.HTTPError, httpx.NetworkError) as e:
                        if attempt == max_retries - 1:
                            raise
                        logger.warning(f"EPSS request failed (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {delay}s...")
                        time.sleep(delay)
                        delay *= 2

                if not response:
                    continue
                    
                response.raise_for_status()
                data = response.json()
                
                # Cache the successful refresh timestamp
                if self.redis:
                    self.redis.set("epss:last_refresh", datetime.utcnow().isoformat() + "Z")
                
                # Parse data
                api_data = data.get("data", [])
                fetched_cves = set()
                
                pipeline = self.redis.pipeline() if self.redis else None
                
                for item in api_data:
                    cve = item.get("cve", "").upper().strip()
                    if not cve:
                        continue
                    try:
                        epss_score = float(item.get("epss", 0.0))
                        epss_percentile = float(item.get("percentile", 0.0))
                    except (TypeError, ValueError):
                        epss_score = 0.0
                        epss_percentile = 0.0
                        
                    payload = {
                        "epss_score": epss_score,
                        "epss_percentile": epss_percentile
                    }
                    results[cve] = payload
                    fetched_cves.add(cve)
                    
                    # Cache in Redis for 24h
                    if pipeline:
                        pipeline.set(f"epss:{cve}", json.dumps(payload), ex=86400)
                
                # For any CVEs requested but not returned by the API, cache empty/zero values to avoid retries
                for cve in chunk:
                    if cve not in fetched_cves:
                        empty_payload = {"epss_score": 0.0, "epss_percentile": 0.0}
                        results[cve] = empty_payload
                        if pipeline:
                            pipeline.set(f"epss:{cve}", json.dumps(empty_payload), ex=86400)
                            
                if pipeline:
                    pipeline.execute()
                    
            except Exception as e:
                logger.error(f"Error fetching batch from FIRST.org EPSS API: {e}")
                # Don't cache errors, but return defaults
                for cve in chunk:
                    if cve not in results:
                        results[cve] = {"epss_score": 0.0, "epss_percentile": 0.0}

        return results
