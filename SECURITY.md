# Security Policy & Multi-Tenancy Architecture

This document describes the multi-tenant isolation model, security controls, and endpoint audit policies implemented in the SigmaSec Security Platform.

---

## 1. Multi-Tenant Isolation Design

SigmaSec enforces strict logical database isolation to protect tenant data. Our isolation model is structured as follows:

- **Organizational Identity**:
  - Every tenant belongs to an `Org` (organization).
  - Every authenticated session has a JWT containing the user's validated `org_id` and role permissions, signed server-side by the backend.
- **Logical Query Filtering**:
  - The database queries for scans, findings, and assets are logically bound by the active tenant's `org_id`.
  - Example:
    ```python
    db.query(Finding).filter(Finding.org_id == org_id)
    ```
- **Performance Indexing**:
  - To support high-throughput concurrent scan runs across multiple tenants without query degradation, composite database indexes are set up on:
    - `idx_findings_org_scan` on `(org_id, scan_id)`
    - `idx_findings_org_severity` on `(org_id, severity)`
  - These indexes ensure PostgreSQL queries are partitioned logically at the database level, preventing table scan overflows.

---

## 2. Multi-Tenant API Protection & Endpoint Auditing

To prevent ID harvesting or direct object reference (IDOR) attacks, the API endpoints validate access permission before returning data or executing updates:

1. **Existence Verification**:
   - The server first queries the requested resource by its primary UUID (e.g., `Finding.id == finding_id`) without filtering by the organization.
   - If the resource does not exist, a standard `404 Not Found` exception is raised.
2. **Organization Matching**:
   - If the resource exists, the backend verifies that the resource's `org_id` matches the user's `org_id`.
   - If there is a mismatch (an Org A user attempts to read or mutate Org B's details), the backend raises a `403 Forbidden` exception:
     ```python
     if record.org_id != user.org_id:
         raise HTTPException(status_code=403, detail="Access forbidden")
     ```
   - Returning `403 Forbidden` explicitly ensures that security monitors and firewalls capture and alert on cross-tenant enumeration attempts.

### Audited Endpoints

The following single-item endpoints are validated for cross-tenant isolation:
- `GET /findings/{finding_id}`
- `PATCH /findings/{finding_id}`
- `POST /findings/{finding_id}/tags`
- `DELETE /findings/{finding_id}/tags/{name}`
- `POST /findings/{finding_id}/create-jira-ticket`
- `POST /findings/{finding_id}/create-fix-pr`
- `POST /findings/{finding_id}/regenerate-ai`
- `GET /findings/{finding_id}/ai-enrichment`
- `GET /scans/{scan_id}`
- `GET /assets/{asset_id}`
- `GET /assets/{asset_id}/findings`
- `PATCH /assets/{asset_id}`

---

## 3. Property-Based Testing Validation

We verify our multi-tenant isolation model using **Hypothesis property-based tests** (under `backend/tests/test_multitenancy.py`). 

These tests mathematically guarantee that:
$$\forall \text{ org\_a, org\_b} \text{ where org\_a } \neq \text{ org\_b, no Org A database filter query can return Org B rows.}$$

This property is evaluated against randomized UUID generations to prevent regressions in filtering logic.
