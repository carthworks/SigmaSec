import os
import json
import logging
import time
from datetime import datetime
import httpx
import redis

logger = logging.getLogger(__name__)

class NVDClient:
    def __init__(self):
        self.api_key = os.environ.get("NVD_API_KEY")
        self.redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
        try:
            # decode_responses=True ensures we get back unicode strings instead of bytes
            self.redis = redis.from_url(self.redis_url, decode_responses=True)
        except Exception as e:
            logger.error(f"Failed to initialize Redis in NVDClient: {e}")
            self.redis = None
            
        self.base_url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
        
    def get_cve(self, cve_id: str) -> dict:
        """
        Retrieves CVE details from NVD API, caching results in Redis for 24 hours.
        """
        if not cve_id:
            return self._get_empty_payload("")
            
        cve_id = cve_id.upper().strip()
        cache_key = f"nvd:{cve_id}"
        
        # 1. Try Redis cache first
        if self.redis:
            try:
                cached = self.redis.get(cache_key)
                if cached:
                    logger.info(f"NVD Cache hit for {cve_id}")
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Error reading from Redis cache: {e}")

        # 2. Fetch from NVD API on cache miss
        headers = {}
        if self.api_key:
            headers["apiKey"] = self.api_key
            
        params = {"cveId": cve_id}
        
        try:
            logger.info(f"NVD Cache miss. Fetching {cve_id} from NVD API with retries...")
            
            # Retry mechanism with 3x exponential backoff
            max_retries = 3
            delay = 1.0
            response = None
            for attempt in range(max_retries):
                try:
                    response = httpx.get(
                        self.base_url,
                        params=params,
                        headers=headers,
                        timeout=10.0
                    )
                    # If forbidden/rate limited, we shouldn't retry if it's 403,
                    # but if it's a 429 or 5xx, we should retry.
                    if response.status_code in (429, 502, 503, 504) or response.status_code >= 500:
                        response.raise_for_status()
                    break
                except (httpx.HTTPError, httpx.NetworkError) as e:
                    if attempt == max_retries - 1:
                        raise
                    logger.warning(f"NVD request failed (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {delay}s...")
                    time.sleep(delay)
                    delay *= 2

            if not response:
                return self._get_empty_payload(cve_id)
                
            if response.status_code == 403:
                logger.error(f"NVD API 403 Forbidden/Rate limit exceeded for {cve_id}. Verify NVD_API_KEY.")
                return self._get_empty_payload(cve_id)
                
            response.raise_for_status()
            data = response.json()
            
            # Cache the successful refresh timestamp
            if self.redis:
                self.redis.set("nvd:last_refresh", datetime.utcnow().isoformat() + "Z")
            
            parsed_data = self._parse_nvd_response(data, cve_id)
            
            # 3. Cache parsed data back in Redis
            if self.redis and parsed_data:
                try:
                    self.redis.set(cache_key, json.dumps(parsed_data), ex=86400)
                except Exception as e:
                    logger.warning(f"Error writing to Redis cache: {e}")
                    
            return parsed_data
            
        except Exception as e:
            logger.error(f"Error fetching from NVD API for {cve_id}: {e}")
            return self._get_empty_payload(cve_id)
            
    def _parse_nvd_response(self, data: dict, cve_id: str) -> dict:
        vulnerabilities = data.get("vulnerabilities", [])
        if not vulnerabilities:
            return self._get_empty_payload(cve_id)
            
        cve = vulnerabilities[0].get("cve", {})
        
        # Extract CVSS v3 baseScore and vectorString
        metrics = cve.get("metrics", {})
        cvss_data = None
        
        # Try CVSS v3.1 first
        cvss_v31 = metrics.get("cvssMetricV31", [])
        if cvss_v31:
            cvss_data = cvss_v31[0].get("cvssData")
            
        # Fallback to CVSS v3.0
        if not cvss_data:
            cvss_v30 = metrics.get("cvssMetricV30", [])
            if cvss_v30:
                cvss_data = cvss_v30[0].get("cvssData")
                
        cvss_score = None
        cvss_vector = None
        if cvss_data:
            cvss_score = cvss_data.get("baseScore")
            cvss_vector = cvss_data.get("vectorString")
            
        # Extract English description
        descriptions = cve.get("descriptions", [])
        description = None
        for desc in descriptions:
            if desc.get("lang") == "en":
                description = desc.get("value")
                break
        if not description and descriptions:
            description = descriptions[0].get("value")
            
        # Extract CWEs
        cwe_list = []
        weaknesses = cve.get("weaknesses", [])
        for weakness in weaknesses:
            for desc in weakness.get("description", []):
                val = desc.get("value", "")
                if val.startswith("CWE-") and val not in cwe_list:
                    cwe_list.append(val)
                    
        return {
            "cve_id": cve_id,
            "cvss_score": cvss_score,
            "cvss_vector": cvss_vector,
            "description": description,
            "cwe": cwe_list
        }
        
    def _get_empty_payload(self, cve_id: str) -> dict:
        return {
            "cve_id": cve_id,
            "cvss_score": None,
            "cvss_vector": None,
            "description": None,
            "cwe": []
        }
