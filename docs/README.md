### Project Architecture Rule

- All authentication and user/session management features should be designed for easy migration to managed/cloud identity providers (e.g., AWS Cognito, Auth0, Azure AD B2C).
- Use JWT-based authentication for local/dev environments, with clear abstraction to allow future upgrade or migration.
- Avoid hard-coding provider-specific logic; use interfaces or adapters where possible.
- Document any assumptions or integration points in the code and README.

## OneApp

OneApp is a secure, testable, customer-centered personal finance platform.

## Mission

The mission of this project is to build a trustworthy financial product that:

- protects sensitive user and financial data
- prioritizes customer-understandable journeys over incomplete technical features
- fails fast through strong automated testing and clear API contracts
- ships in phased increments without letting undocumented behavior become the product

## Primary Market Assumption

OneApp should be planned first for people in the United Kingdom unless a requirement explicitly states otherwise.

- Customer-facing copy should use UK English.
- Monetary amounts should default to GBP.
- Time and date behaviour should assume `Europe/London` and UK user expectations.
- Banking and consent journeys should assume UK Open Banking and UK regulatory expectations for the active feature scope.
- No feature should be described as fully compliant or production-ready until it has passed explicit legal, privacy, and security review for the relevant UK obligations.

## Current Delivery Phase

The project is currently in a foundation and realignment phase.

### Active Prototype Scope

- backend registration and login APIs for prototype and test environments
- authenticated dashboard summary API for prototype and test environments
- authenticated one-time expense and income CRUD APIs for prototype and test environments
- authenticated mocked bank-linking status, link, and ingestion APIs for prototype and test environments
- frontend registration flow that starts an authenticated session and routes to the dashboard
- frontend login flow that starts an authenticated session and routes to the dashboard
- frontend dashboard landing view with summary cards, grouped categories, reminder status, and one-time entry management
- frontend sign-out flow that ends the current device session and returns to sign-in
- authenticated read-only account lookup via `/api/account`
- planning and documentation for dashboard, budgeting, notifications, reporting, and bank sync

### Deprecated or Deferred Scope

- password reset workflow
- profile editing and password change flows
- manual recurring-payment CRUD endpoints and dashboard management UI

These flows have been explicitly deprecated in code and tests until they are realigned with the documented product design.

## Planning Documents

- `docs/jira_import.csv` and `docs/jira_import_aligned.csv` represent roadmap and target-state planning.
- They may include deferred work that is not currently enabled in the prototype.
- Current enabled or deprecated behavior should be validated against this README, the OpenAPI spec, and the test strategy.
- `docs/user_registration_login_bdd.csv` describes the target-state customer behavior.
- `docs/auth_scope_status.md` describes the current prototype scope, deprecated flows, and reactivation expectations.
- `docs/SCOPE_MATRIX.md` shows whole-product status across active, planned, deprecated, and target-state areas.
- `docs/PHASED_DELIVERY_ROADMAP.md` sequences delivery so prototype work does not outrun the documented design.
- `docs/platform_setup_bootstrap.md` defines the target monorepo foundation, workspace boundaries, and bootstrap flow.
- `docs/architecture/target_monorepo_foundation.mmd` is the architecture baseline diagram for the target monorepo migration.
- `docs/adr/` stores short architecture and delivery decisions that explain why the team is working this way.

## Ambiguity Rule

- Resolve ambiguity against the current source of truth first: active code, tests, OpenAPI, this README, and the current story acceptance criteria.
- If the ambiguity can be handled with a small reversible assumption that does not change documented requirements, proceed with the narrowest reasonable interpretation and record the assumption where needed.
- If resolving the ambiguity would change requirements, scope, customer-facing behaviour, or compliance assumptions, stop and get an explicit decision rather than guessing.
- Changes to documented requirements need agreement from at least two parties before implementation continues: the product or requirement owner, and an engineering or delivery reviewer.

### Launch Instructions

#### Root Workspace Bootstrap
1. Install workspace dependencies from repository root:
	```bash
	npm install
	```
2. Start the active prototype backend from root:
	```bash
	npm run dev:backend
	```
3. Start the active prototype frontend from root:
	```bash
	npm run dev:frontend
	```

#### Direct Prototype Commands (unchanged fallback)
1. Start backend directly:
	```bash
	cd backend
	npm install
	npm start
	```
2. Start frontend directly:
	```bash
	cd frontend
	npm install
	npm start
	```

The backend server runs on http://localhost:4000 and the prototype frontend runs on http://localhost:3000.

The current frontend is still a prototype surface. The registration flow, login flow, dashboard landing view, and authenticated account summary are active for manual testing, while deprecated or target-state-only customer journeys should not be treated as production-ready features.

Manual recurring-payment CRUD has now been deprecated in code. The revised target-state backlog expects recurring obligations to be gathered from linked bank-account data, so those old management endpoints and UI should no longer be treated as active prototype behaviour.

For quick prototype sign-in after a backend restart, a seeded demo account is available in local development:

- Email address: `demo@oneapp.local`
- Password: `DemoPass123!`

### Running Tests

#### From Repository Root
```bash
npm run test:backend
npm run test:frontend
npm run lint:contracts
```

#### Direct Commands (unchanged fallback)
```bash
cd backend && npm test
cd frontend && npm test
```

### Session Management (Authentication)

- JWT-based authentication protects endpoints (e.g., `/api/account`).
- `POST /api/logout` is available as a minimal stateless logout acknowledgement for the current device session.
- The frontend must clear the stored JWT after sign-out; the backend does not currently revoke issued tokens server-side.
- Profile editing and password change are deprecated until account management is redesigned and re-scoped.
- See `backend/session.test.js` for test coverage and prioritization.

See `docs/test_coverage_prioritization.md` for details.

### Recurring Payments

- Manual recurring-payment management is deprecated and now returns explicit deprecation responses from the API.
- The dashboard summary starts from the seeded prototype financial profile, then switches to detected linked recurring obligations and saved one-time entries when that prototype data is available.
- Target-state recurring obligations will be gathered from linked bank-account data rather than manual entry.

### Recurring Obligations Detection

- `GET /api/recurring-obligations` returns read-only recurring obligations detected from booked linked-account transactions.
- The dashboard now switches from seeded prototype recurring data to sourced recurring obligations when the mocked bank-linked feed provides enough evidence.
- Dashboard responses include recurring-data source metadata so bank-linked behaviour and prototype fallback can be distinguished cleanly.

### One-Time Expenses And Income

- `GET /api/one-time-entries` returns saved one-time expense and income entries for the authenticated user.
- `POST /api/one-time-entries`, `PUT /api/one-time-entries/{entryId}`, and `DELETE /api/one-time-entries/{entryId}` allow the prototype dashboard to create, edit, and remove one-off financial items.
- Saved one-time income increases the dashboard income total, and saved one-time expenses increase day-to-day spending and reduce available funds.
- The dashboard now includes a customer-facing one-off entry section so prototype users can record and amend one-time items without editing seeded recurring obligations.

### Mocked Bank Linking

- `GET /api/bank-sync/status` returns the current mocked bank-link status, provider-strategy metadata, consent state, and latest ingestion summary for the authenticated user.
- `POST /api/bank-sync/mock-link` creates a mocked linked-account record for development and test environments.
- `POST /api/bank-sync/mock-ingest` ingests mocked booked transactions, reports duplicate and partial-ingestion outcomes, and avoids any live provider dependency.
- This is a backend-only prototype slice intended to stabilise the UK provider strategy, internal transaction contract, and consent boundaries before live bank sync is introduced.

### Prototype Observability And Accessibility

- The backend now emits lightweight structured logs for authentication failures, bank-linking rejections, one-time-entry mutations, and HTTP request failures in the active prototype scope.
- The active frontend flows include stronger accessible status and error announcements for sign-in, registration, account loading, and one-time-entry management.
- This remains prototype-grade observability rather than production monitoring; central telemetry, tracing, and full alerting are still target-state work.

### Password Reset API

The password reset workflow is deprecated until it is realigned with the documented product design:
- `POST /api/password-reset`: Deprecated
- `POST /api/password-reset/confirm`: Deprecated

### Account Management

- `GET /api/account` remains available as a read-only prototype endpoint.
- `PUT /api/account` is deprecated.
- `PUT /api/account/password` is deprecated.

See `docs/test_coverage_prioritization.md` for detailed test coverage and prioritization for all endpoints.

---
For more details, see the OpenAPI spec in `docs/openapi.yaml`.