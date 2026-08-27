import json
from unittest.mock import MagicMock, patch
import pytest

from app.intel.kev import KEVClient
from app.tasks.scan_tasks import refresh_kev_feed

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

def test_kev_client_fetch_and_load(mock_redis, mock_httpx):
    mock_redis.pipeline.return_value = mock_redis
    mock_redis.execute.return_value = None
    
    # Mock KEV JSON response
    kev_json = {
        "title": "CISA KEV Feed",
        "catalogVersion": "2026.07.09",
        "dateReleased": "2026-07-09T12:00:00Z",
        "count": 2,
        "vulnerabilities": [
            {
                "cveID": "CVE-2023-38606",
                "vendorProject": "Apple",
                "product": "iOS and macOS",
                "dueDate": "2023-08-15"
            },
            {
                "cveID": "CVE-2023-23397",
                "vendorProject": "Microsoft",
                "product": "Outlook",
                "dueDate": "2023-09-01"
            }
        ]
    }
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = kev_json
    mock_httpx.return_value = mock_response

    client = KEVClient()
    count = client.fetch_and_load_kev()

    # Verify counts and Redis transactions
    assert count == 2
    mock_redis.delete.assert_any_call("kev:cves:temp")
    mock_redis.delete.assert_any_call("kev:due_dates:temp")
    mock_redis.sadd.assert_any_call("kev:cves:temp", "CVE-2023-38606", "CVE-2023-23397")
    mock_redis.hset.assert_any_call("kev:due_dates:temp", mapping={"CVE-2023-38606": "2023-08-15", "CVE-2023-23397": "2023-09-01"})
    mock_redis.rename.assert_any_call("kev:cves:temp", "kev:cves")
    mock_redis.rename.assert_any_call("kev:due_dates:temp", "kev:due_dates")

def test_kev_client_lookup(mock_redis):
    # Setup lookup behavior
    mock_redis.sismember.side_effect = lambda key, val: val == "CVE-2023-23397"

    client = KEVClient()
    
    # Exists in cache
    assert client.is_cve_kev("CVE-2023-23397") is True
    # Doesn't exist in cache
    assert client.is_cve_kev("CVE-2023-11111") is False

    mock_redis.sismember.assert_any_call("kev:cves", "CVE-2023-23397")
    mock_redis.sismember.assert_any_call("kev:cves", "CVE-2023-11111")

def test_kev_client_due_date_lookup(mock_redis):
    # Setup lookup behavior
    mock_redis.hget.side_effect = lambda key, field: "2023-09-01" if field == "CVE-2023-23397" else None

    client = KEVClient()
    
    # Exists in cache
    assert client.get_kev_due_date("CVE-2023-23397") == "2023-09-01"
    # Doesn't exist in cache
    assert client.get_kev_due_date("CVE-2023-11111") is None

    mock_redis.hget.assert_any_call("kev:due_dates", "CVE-2023-23397")
    mock_redis.hget.assert_any_call("kev:due_dates", "CVE-2023-11111")

@patch("app.tasks.scan_tasks.redis_client")
def test_refresh_kev_feed_celery_task(mock_redis_client, mock_httpx):
    # Mock task environment
    kev_json = {
        "vulnerabilities": [
            {"cveID": "CVE-2024-0001"}
        ]
    }
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = kev_json
    mock_httpx.return_value = mock_response

    result = refresh_kev_feed()
    assert result["status"] == "success"
    assert result["count"] == 1
