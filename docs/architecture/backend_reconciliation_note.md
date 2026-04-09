# Backend Reconciliation Note

This note records how the backend changed as prototype behavior was realigned to the documented product scope.

## What Was Deliberately Deprecated

- Password reset endpoints were kept in the API surface but now return explicit deprecation responses.
- Account profile update and password change flows were kept explicit in code and docs as deprecated until redesign.
- Manual recurring-payment CRUD was withdrawn in favor of bank-linked recurring-obligation detection.

These decisions follow the accepted policy in `docs/adr/0003-deprecation-policy.md` and the active scope documented in `docs/README.md` and `docs/SCOPE_MATRIX.md`.

## What Was Refactored

- Root-level backend tests were moved into `backend/__tests__/` and updated to match the current route structure and `/api/v1` surface.
- Legacy store files under `backend/data/` were replaced by Prisma-backed persistence modules under `backend/db/`.
- The previous root-level `server.js`, `register.js`, and `register.test.js` were superseded by the current backend application layout under `backend/`.

## Replacement Mapping

- `backend/data/userStore.js` -> `backend/db/userStore.js`
- `backend/data/bankSyncStore.js` -> `backend/db/bankSyncStore.js`
- `backend/data/financialStore.js` -> `backend/db/financialProfileStore.js`
- `backend/account.test.js` -> `backend/__tests__/account.test.js`
- `backend/bank-sync.test.js` -> `backend/__tests__/bank-sync.test.js`
- `backend/integration.test.js` -> `backend/__tests__/integration.test.js`
- `backend/login.test.js` -> `backend/__tests__/login.test.js`
- `backend/one-time-entries.test.js` -> `backend/__tests__/one-time-entries.test.js`
- `backend/password-reset.test.js` -> `backend/__tests__/password-reset.test.js`
- `backend/recurring-obligations.test.js` -> `backend/__tests__/recurring-obligations.test.js`
- `backend/recurring-payments.test.js` -> `backend/__tests__/recurring-payments.test.js`
- `backend/register.test.js` -> `backend/__tests__/register.test.js`
- `backend/security_compliance.test.js` -> `backend/__tests__/security_compliance.test.js`
- `backend/session.test.js` -> `backend/__tests__/session.test.js`
- `backend/startup-smoke.test.js` -> `backend/__tests__/startup-smoke.test.js`
- `register.js` -> `backend/register.js`
- `register.test.js` -> `backend/__tests__/register.test.js`
- `server.js` -> `backend/server.js`

## Release Readiness Note

- Frontend dependency deletions under `frontend/node_modules/` were local install-state churn rather than intentional product-scope removals.
- Reinstalling frontend dependencies from the existing manifest and lockfile restored that tree without source changes.