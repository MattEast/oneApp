# ADR 0005 — API Versioning Strategy

**Date:** 2026-04-07  
**Status:** Accepted

## Context

The OneApp API had no explicit version segment in its URL surface. All endpoints were mounted under `/api/<endpoint>`, leaving no mechanism for introducing breaking changes without silently affecting existing consumers. As the product matures, the ability to evolve the contract without forcing all clients to upgrade simultaneously is a hard requirement.

## Decision

All active API endpoints are versioned using a **URL path prefix** of the form `/api/v1/<endpoint>`.

- **Active routes** (register, login, logout, account, dashboard-summary, one-time-entries, bank-sync/*, recurring-obligations) are served under `/api/v1/`.
- **Deprecated routes** (password-reset, account PUT/password, recurring-payments) are also under `/api/v1/` — they remain in the v1 surface but carry `410 Gone` responses and OpenAPI `deprecated: true` markers.
- **`/health`** is a platform concern and remains unversioned at the root.

Header-based versioning (e.g. `Accept: application/vnd.oneapp.v1+json`) was considered and rejected: it is less visible in logs and browser tooling, harder to test with curl, and harder to document with standard OpenAPI `servers` entries.

## Consequences

- The Express sub-router is mounted at `/api/v1` in `server.js`.
- The OpenAPI `servers[0].url` is updated to `http://localhost:4000/api/v1`.
- The frontend `API_BASE_URL` constant in `frontend/api.js` is updated to `http://localhost:4000/api/v1`.
- All supertest calls in backend test suites and all fetch mock matchers in frontend test suites have been updated to use the `/api/v1/` prefix.
- Future breaking changes to the API must introduce a new version prefix (`/api/v2/`) and document a migration period. Non-breaking additions (new fields, new endpoints) may be added to the existing version.
