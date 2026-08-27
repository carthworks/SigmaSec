# SigmaSec — Database Schema

## Tables

### orgs
Top-level tenant. Every other table has `org_id` pointing here.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Display name |
| slug | VARCHAR(100) | Unique short ID (e.g. CS) |
| is_active | BOOLEAN | Soft disable |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

### users
People who log in. Role controls what they can do.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| org_id | UUID | FK → orgs.id |
| email | VARCHAR(255) | Unique login |
| hashed_password | VARCHAR(255) | bcrypt hash |
| full_name | VARCHAR(255) | Display name |
| role | ENUM | admin / analyst / viewer |
| is_active | BOOLEAN | Soft disable |
| is_verified | BOOLEAN | Email verified |

### assets
Things we scan. Weight affects priority scoring.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| org_id | UUID | FK → orgs.id |
| name | VARCHAR(255) | Human label |
| target | VARCHAR(1024) | URL / image / repo |
| asset_type | ENUM | url / docker_image / git_repo |
| asset_weight | FLOAT | 0.5 / 1.0 / 1.5 / 2.0 |
| owner_email | VARCHAR(255) | For Slack tagging (Week 7) |

### scans
One row per scan run.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| org_id | UUID | FK → orgs.id |
| asset_id | UUID | FK → assets.id |
| target | VARCHAR(1024) | What was scanned |
| scan_types | ARRAY | ["vuln","sca","secret"] |
| status | ENUM | queued/running/complete/failed |
| celery_task_id | VARCHAR | Celery tracking |
| exec_summary | TEXT | AI generated (Week 7) |

### findings
Heart of the platform. One row per vulnerability.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| org_id | UUID | FK → orgs.id |
| scan_id | UUID | FK → scans.id |
| asset_id | UUID | FK → assets.id |
| title | VARCHAR(512) | Finding name |
| severity | ENUM | critical/high/medium/low/info |
| cve_id | VARCHAR(30) | e.g. CVE-2024-6387 |
| tool | VARCHAR(50) | nuclei/trivy/gitleaks |
| cvss_score | FLOAT | Week 5 (NVD) |
| epss_score | FLOAT | Week 5 (FIRST) |
| kev_listed | BOOLEAN | Week 5 (CISA) |
| priority_score | FLOAT | Week 5 (computed) |
| ai_plain_english | TEXT | Week 6 (Claude) |
| ai_remediation | JSONB | Week 6 (Claude) |
| reachability | ENUM | Week 6 (Claude) |
| exploit_validated | BOOLEAN | Week 4 (FR-SCN-13) |
| jira_issue_key | VARCHAR(50) | Week 7 |
| pr_url | VARCHAR(512) | Week 7 |
| metadata | JSONB | Raw tool output |
| fp_candidate | BOOLEAN | False positive flag |

## Relationships
