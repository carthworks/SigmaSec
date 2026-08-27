import json
from unittest.mock import MagicMock, patch
import pytest

from app.intel.epss import EPSSClient

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

def test_epss_client_cache_hits(mock_redis):
    # Setup cache hits
    mock_redis.mget.return_value = [
        json.dumps({"epss_score": 0.05, "epss_percentile": 0.85}),
        json.dumps({"epss_score": 0.92, "epss_percentile": 0.99})
    ]

    client = EPSSClient()
    result = client.get_epss_scores(["CVE-2023-1111", "CVE-2023-2222"])

    assert result["CVE-2023-1111"] == {"epss_score": 0.05, "epss_percentile": 0.85}
    assert result["CVE-2023-2222"] == {"epss_score": 0.92, "epss_percentile": 0.99}

    mock_redis.mget.assert_called_once_with(["epss:CVE-2023-1111", "epss:CVE-2023-2222"])
    with patch("httpx.get") as mock_get:
        assert not mock_get.called

def test_epss_client_cache_miss_api_success(mock_redis, mock_httpx):
    mock_redis.mget.return_value = [None, None]
    mock_redis.pipeline.return_value = mock_redis
    mock_redis.execute.return_value = None

    # Mock FIRST.org response
    api_response = {
        "status": "OK",
        "data": [
            {
                "cve": "CVE-2023-1111",
                "epss": "0.051200000",
                "percentile": "0.854000000"
            },
            {
                "cve": "CVE-2023-2222",
                "epss": "0.924500000",
                "percentile": "0.992000000"
            }
        ]
    }
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = api_response
    mock_httpx.return_value = mock_response

    client = EPSSClient()
    result = client.get_epss_scores(["CVE-2023-1111", "CVE-2023-2222"])

    assert result["CVE-2023-1111"] == {"epss_score": 0.0512, "epss_percentile": 0.854}
    assert result["CVE-2023-2222"] == {"epss_score": 0.9245, "epss_percentile": 0.992}

    # Verify pipeline cache updates
    mock_redis.set.assert_any_call("epss:CVE-2023-1111", json.dumps({"epss_score": 0.0512, "epss_percentile": 0.854}), ex=86400)
    mock_redis.set.assert_any_call("epss:CVE-2023-2222", json.dumps({"epss_score": 0.9245, "epss_percentile": 0.992}), ex=86400)
