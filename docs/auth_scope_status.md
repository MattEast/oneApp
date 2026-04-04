# Auth Scope Status

## Purpose

This document describes the current prototype status of authentication and account-related flows. Use it alongside `docs/user_registration_login_bdd.csv`, which captures the target-state customer behavior.

## Active Prototype Scope

- `POST /api/register` is available for backend prototype and test usage.
- `POST /api/login` is available for backend prototype and test usage.
- `POST /api/logout` is available as a stateless logout acknowledgement for prototype manual testing.
- `GET /api/dashboard-summary` is available as an authenticated prototype endpoint.
- `GET /api/one-time-entries`, `POST /api/one-time-entries`, `PUT /api/one-time-entries/{entryId}`, and `DELETE /api/one-time-entries/{entryId}` are available as authenticated prototype endpoints.
- Frontend registration completion flow is available for prototype manual testing.
- Frontend login completion flow is available for prototype manual testing.
- Frontend dashboard landing view is available for prototype manual testing.
- Frontend one-time entry creation, editing, and deletion are available for prototype manual testing.
- Frontend sign-out flow is available for prototype manual testing.
- `GET /api/account` is available as a read-only authenticated endpoint.
- Validation and negative-path tests remain active for the prototype auth surface.

## Deprecated Scope

- `POST /api/password-reset`
- `POST /api/password-reset/confirm`
- `PUT /api/account`
- `PUT /api/account/password`

Deprecated flows must return explicit deprecation behavior in code and remain excluded from active customer-journey tests.

## Deferred Design Work

- Duplicate-email handling in the full customer journey
- Dashboard data beyond the current prototype summary cards, grouped lists, recurring-data source state, and one-time entry management
- Password reset journey
- Profile management journey
- Password change journey
- Server-side token revocation, multi-device logout, and full session invalidation strategy

## Reactivation Criteria

A deprecated auth flow should only be reactivated when all of the following are true:

- The target customer journey is defined in `docs/user_registration_login_bdd.csv`.
- The API contract is updated in `docs/openapi.yaml`.
- The roadmap reflects the work in `docs/jira_import.csv` or `docs/jira_import_aligned.csv`.
- Acceptance criteria and tests are updated together.
- The behavior fits the target architecture in `docs/TECH_STACK.md`.
