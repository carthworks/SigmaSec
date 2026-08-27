# Nuclei Scan Result Field Mapping

This document describes the JSON structure produced by the Nuclei scanner (running with the `-json` or `-jsonl` flags) and how it maps to the SQL database schema of the CyberSigma platform.

## JSON Structure (One Finding per Line, JSONL Format)

A typical Nuclei output record conforms to the following JSON structure:

```json
{
  "template": "misconfiguration/http-missing-security-headers.yaml",
  "template-id": "http-missing-security-headers",
  "template-url": "https://github.com/projectdiscovery/nuclei-templates/blob/master/misconfiguration/http-missing-security-headers.yaml",
  "info": {
    "name": "HTTP Missing Security Headers",
    "author": ["socketz", "geeknik"],
    "tags": ["misconfig", "generic"],
    "description": "It searches for missing security headers.",
    "severity": "info"
  },
  "type": "http",
  "host": "https://example.com",
  "matched-at": "https://example.com",
  "timestamp": "2021-10-17T06:54:47.293154+05:30",
  "curl-command": "curl -X 'GET' 'https://example.com'",
  "matcher-status": true
}
```

---

## Field Mapping Strategy

The table below outlines how fields from the raw Nuclei JSON lines translate into the `Finding` database model schema defined in [finding.py](file:///c:/Users/tkart/Dev/products/AI-Augmented%20Security%20Posture%20Intelligence%20Platform/security-platform/backend/app/models/finding.py).

| Nuclei JSON Field | Database Model Attribute | Target Type | Description / Notes |
| :--- | :--- | :--- | :--- |
| `template-id` | `finding.title` | `String(512)` | The ID of the template matched (e.g., `http-missing-security-headers`). *Fallback: Use `info.name` if cleaner.* |
| `info.severity` | `finding.severity` | `Enum(Severity)` | Maps directly to the DB enum (`critical`, `high`, `medium`, `low`, `info`). |
| `matched-at` | `finding.url` | `String(1024)` | The specific URL or address that triggered the check. |
| `info.description` | `finding.description` | `Text` | Description of the threat vector or security issue. |
| (Entire JSON Object) | `finding.metadata` | `JSONB` | Persisted raw JSON payload for threat intelligence parsing. |
| (Hardcoded) | `finding.tool` | `String(50)` | `"nuclei"` |

---

## Severity Conversion Matrix

Nuclei severity strings map 1-to-1 to our severity levels.

| Nuclei `info.severity` | DB `Severity` Enum |
| :--- | :--- |
| `critical` | `Severity.critical` |
| `high` | `Severity.high` |
| `medium` | `Severity.medium` |
| `low` | `Severity.low` |
| `info` | `Severity.info` |
| `unknown` | `Severity.info` (default fallback) |
