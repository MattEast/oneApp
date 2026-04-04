# Completed Tasks

## Completed And Still Active

| Date       | Task                                      | Details                                  |
|------------|-------------------------------------------|------------------------------------------|
| 2026-03-31 | Implement backend login endpoint tests     | login.test.js, README, OpenAPI updated   |
| 2026-03-31 | Add prioritization to login tests         | Complexity/impact ratings in docs        |
| 2026-03-31 | Move test coverage/prioritization to doc  | test_coverage_prioritization.md created  |
| 2026-03-31 | Design login form | Frontend/Login.js, __tests__/Login.test.js implemented and tested |
| 2026-03-31 | Add error handling and feedback | Frontend and backend error feedback for registration and login |
| 2026-04-03 | Audit completed prototype stories | Reclassified deprecated work, aligned backlog completion flags, and kept unresolved follow-on work in to-do |
| 2026-04-03 | Deprecate mismatched account-management flows | Deprecated profile editing and password change in code, tests, and docs |
| 2026-04-03 | Deprecate mismatched auth lifecycle flows | Deprecated password reset and partial frontend auth success flows pending redesign |
| 2026-04-03 | Reactivate basic session sign-out flow | Added current-device sign-out in frontend and backend, refreshed tests, and updated auth lifecycle docs |
| 2026-04-03 | Close auth and dashboard debt in active prototype stories | Improved auth-form accessibility, added safe dashboard empty states, and expanded test coverage for active journeys |
| 2026-04-03 | Refactor backend foundations for next financial story | Split auth, JWT middleware, in-memory user storage, dashboard summary building, and financial-data seeding into dedicated backend modules while preserving route behavior |
| 2026-04-03 | Deliver recurring payments prototype scaffold | Added authenticated recurring-payment CRUD, wired dashboard recalculation from saved payments, and expanded frontend/backend tests and API docs; this remains temporary prototype scaffolding because the target-state story has been revised to bank-sourced recurring-payment detection |
| 2026-04-04 | Deprecate manual recurring-payment management | Replaced recurring-payment CRUD endpoints with explicit deprecation responses, removed dashboard management UI, and rewrote tests around the bank-linked target-state direction |
| 2026-04-04 | Implement mocked bank-linked ingestion slice | Added authenticated mocked bank-link status, link, and ingestion APIs with duplicate and partial-ingestion handling, tests, and contract updates |
| 2026-04-04 | Detect recurring obligations from mocked linked data | Added recurring-obligation detection from booked linked-account transactions, a read-only obligations API, dashboard source switching, and backend tests |
| 2026-04-04 | Implement one-time expenses and income | Added authenticated one-time entry CRUD APIs, dashboard create-edit-delete UI, dashboard recalculation for one-off items, and backend/frontend test coverage |
| 2026-04-04 | Sweep backlog and prototype bookkeeping debt | Normalized completion flags for shipped slices, removed misleading completed-story flags where open work remains, and updated scope and test-priority docs to match the active prototype |
| 2026-04-04 | Close active prototype accessibility and logging debt | Added lightweight structured backend observability for auth and financial flows, improved accessible state and error announcements in live frontend journeys, and aligned backlog bookkeeping for those cross-cutting tasks |
| 2026-04-04 | Establish target monorepo foundation | Added root npm workspace config, scaffolded apps/packages/infra boundaries, published bootstrap guidance, and added the target monorepo architecture diagram |
| 2026-04-04 | Capture login incident retro improvements | Added branch and bug-fix workflow rules, strengthened smoke and regression test expectations, and documented service-stability checks in ways of working docs |

## Returned To To-Do

| Date Reopened | Task | Why It Returned To To-Do |
|---------------|------|--------------------------|
| 2026-04-03 | Implement password reset feature | The prototype password reset endpoints were later deprecated. Active work is now to redesign and re-scope the password reset journey before implementation resumes. |
| 2026-04-03 | Implement authentication/session management | Prototype JWT auth, protected routes, and sign-out exist, but the full target-state session lifecycle and account-management behaviour remain unresolved and are still planned work. |
