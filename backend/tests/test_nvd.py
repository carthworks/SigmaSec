import json
from unittest.mock import MagicMock, patch
import pytest

from app.intel.nvd import NVDClient

@pytest.fixture
def mock_redis():
    with patch("redis.from_url") as mock_from_url:
        mock_client = MagicMock()
        mock_from_url.return_value = mock_client
        yield mock_client

@pytest.fixture
def mock_httpx():
    with patch("httpx.get") as mock_get:
        yield mock_get

def test_nvd_client_cache_hit(mock_redis):
    # Setup cache hit payload
    mock_payload = {
        "cve_id": "CVE-2023-1234",
        "cvss_score": 7.5,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
        "description": "Mock CVE description text",
        "cwe": ["CWE-79"]
    }
    mock_redis.get.return_value = json.dumps(mock_payload)

    client = NVDClient()
    result = client.get_cve("CVE-2023-1234")

    assert result == mock_payload
    mock_redis.get.assert_called_once_with("nvd:CVE-2023-1234")
    # API should not be called on cache hit
    with patch("httpx.get") as mock_get:
        assert not mock_get.called

def test_nvd_client_cache_miss_api_success(mock_redis, mock_httpx):
    mock_redis.get.return_value = None
    
    # Mock NVD API response JSON
    nvd_response = {
        "vulnerabilities": [
            {
                "cve": {
                    "id": "CVE-2023-1234",
                    "descriptions": [
                        {"lang": "en", "value": "A critical SQL injection vulnerability"}
                    ],
                    "weaknesses": [
                        {
                            "description": [
                                {"lang": "en", "value": "CWE-89"}
                            ]
                        }
                    ],
                    "metrics": {
                        "cvssMetricV31": [
                            {
                                "cvssData": {
                                    "baseScore": 9.8,
                                    "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
                                }
                            }
                        ]
                    }
                }
            }
        ]
    }
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = nvd_response
    mock_httpx.return_value = mock_response

    client = NVDClient()
    result = client.get_cve("CVE-2023-1234")

    # Verify return payload
    assert result["cve_id"] == "CVE-2023-1234"
    assert result["cvss_score"] == 9.8
    assert result["cvss_vector"] == "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
    assert result["description"] == "A critical SQL injection vulnerability"
    assert result["cwe"] == ["CWE-89"]

    # Verify caching happened
    mock_redis.set.assert_called_once()
    cache_key, cache_val = mock_redis.set.call_args[0]
    assert cache_key == "nvd:CVE-2023-1234"
    assert json.loads(cache_val) == result

def test_nvd_client_fallback_to_v30(mock_redis, mock_httpx):
    mock_redis.get.return_value = None
    
    # Mock NVD API response JSON with only CVSS 3.0 metrics
    nvd_response = {
        "vulnerabilities": [
            {
                "cve": {
                    "id": "CVE-2023-1234",
                    "descriptions": [
                        {"lang": "en", "value": "A medium vulnerability"}
                    ],
                    "metrics": {
                        "cvssMetricV30": [
                            {
                                "cvssData": {
                                    "baseScore": 5.5,
                                    "vectorString": "CVSS:3.0/AV:L/AC:L/PR:L/UI:R/S:U/C:H/I:N/A:N"
                                }
                            }
                        ]
                    }
                }
            }
        ]
    }
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = nvd_response
    mock_httpx.return_value = mock_response

    client = NVDClient()
    result = client.get_cve("CVE-2023-1234")

    # Verify fallback worked
    assert result["cvss_score"] == 5.5
    assert result["cvss_vector"] == "CVSS:3.0/AV:L/AC:L/PR:L/UI:R/S:U/C:H/I:N/A:N"
