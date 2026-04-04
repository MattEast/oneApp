# Architecture & Implementation Requirements

To ensure the project architecture remains aligned with the plan and supports maintainable, scalable development, the following requirements must be followed:

## 0. Primary Market Assumption
- Unless a document explicitly says otherwise, the product should be designed first for people in the United Kingdom.
- Customer-facing experiences should default to UK English, GBP, and UK-appropriate financial terminology.
- Date, time, and reporting behaviour should assume `Europe/London` and UK user expectations unless a feature explicitly supports multiple locales.
- Banking, consent, privacy, and data-retention decisions must assume UK regulatory expectations for the active scope.

## 1. Documented Architecture
- Maintain a clear, up-to-date architecture diagram (e.g., in `docs/` or `wireframes/`) showing frontend, backend, data flow, and integrations.
- Document technology stack, key design decisions, and rationale in `docs/TECH_STACK.md`.
- Treat documentation as the source of truth for active, deferred, and deprecated behavior.

## 2. Modular Code Structure
- Organize code into logical modules (e.g., user management, dashboard, payments) with clear boundaries.
- Use separate folders for frontend, backend, and shared assets.
- Do not extend prototype-only or deprecated flows without first updating the design and documentation.

## 3. API Contract & Versioning
- Define all API endpoints and data contracts in `docs/openapi.yaml`.
- Use versioning for APIs to avoid breaking changes.
- Mark deprecated endpoints explicitly in the API contract and tests.

## 4. Testing & CI/CD
- Require automated tests for all features (unit, integration, end-to-end).
- Set up CI/CD pipelines to run tests and enforce code quality before merging.

## 5. Acceptance Criteria Enforcement
- All user stories must have clear, testable acceptance criteria.
- New implementation work must be represented in the backlog before coding starts, including cross-cutting technical work and architecture-alignment tasks.
- Pull requests must reference the acceptance criteria and demonstrate coverage.
- If behavior no longer fits the documented design, deprecate it or remove it rather than letting undocumented behavior become the product.

## 6. Security & Compliance
- Enforce secure coding practices (e.g., password hashing, input validation).
- Regularly review and update security requirements (see `backend/security_compliance.test.js`).
- Treat UK GDPR and the Data Protection Act 2018 as baseline privacy requirements for any live or customer-facing scope.
- Where product behaviour falls within regulated UK financial or Open Banking journeys, document FCA-facing obligations, consent boundaries, audit expectations, and operational controls before release.
- Do not describe any feature as production-ready or compliant until the release scope has passed explicit legal, privacy, and security review against applicable UK requirements.

## 7. Documentation & Onboarding
- Keep `README.md` and user/developer docs up to date.
- Document setup steps for new developers (environment, dependencies, scripts).
- Document the difference between roadmap features, active prototype features, and deprecated features.

## 8. Change Management
- Use pull requests for all changes.
- Require code review and approval before merging.

## 9. Ambiguity and Requirement Changes
- When delivery work encounters ambiguity, contributors should first resolve it against the active code, tests, OpenAPI contract, README, and current story acceptance criteria before proposing a broader change.
- If the ambiguity can be resolved with a small, reversible interpretation that does not change documented requirements, proceed with the narrowest reasonable assumption and record that assumption in code, tests, or docs where appropriate.
- If resolving the ambiguity would change documented requirements, customer-facing behaviour, compliance assumptions, or delivery scope, stop and seek an explicit decision instead of guessing.
- Any change to documented requirements must be agreed by at least two parties before implementation continues. One party must be the product or requirement owner, and the second must be an engineering or delivery reviewer.
- Requirement changes must be reflected together in the relevant story, documentation, API contract, and tests so the new decision becomes the active source of truth.

---

**All contributors must review and adhere to these requirements. Updates to this document should be proposed via pull request.**
