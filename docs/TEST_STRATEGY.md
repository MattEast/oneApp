# Test Strategy

## Principles
- **Fail Fast:** Detect and surface defects as early as possible in the development lifecycle.
- **Automate Where Appropriate:** Use automated tests for repeatable, high-value checks (unit, integration, regression, API, UI smoke tests).
- **Test Through the Customer's Eyes:** Prioritize end-to-end scenarios and user journeys that reflect real customer behavior and needs.
- **Get Product in Customers' Hands Quickly:** Shorten feedback loops by releasing early and often to real users (beta, canary, feature flags).
- **Phased Testing Approach:** Layer testing activities to maximize coverage and speed.
- **Protect Scope Integrity:** When a flow is deprecated or deferred, test the deprecation contract explicitly and remove it from active customer-journey coverage until redesign is complete.

## Phased Testing Approach
1. **Developer Phase**
   - Unit tests for all new code (functions, components, API endpoints)
   - Linting and static analysis
   - Run on every commit/push (CI)

2. **Integration Phase**
   - Integration tests for backend APIs and frontend-backend flows
   - Automated API contract tests
   - Run on every pull request (CI)

3. **System/End-to-End Phase**
   - Automated E2E tests for active critical user journeys only
   - Manual exploratory testing for new features
   - Run on staging/pre-production

4. **Customer/Beta Phase**
   - Release to a subset of real users (beta, canary)
   - Collect feedback and monitor for issues
   - Roll out to all users after validation

## Automation Guidelines
- Use Vitest and Testing Library for frontend unit and integration tests in the target stack
- Use backend unit and integration tooling that matches the selected backend framework, with contract-first API testing as the baseline expectation
- Use Playwright for end-to-end customer journeys in the target stack
- Automate regression and smoke tests for every release
- Include at least one process-level smoke test for startup-critical services (for example: start server on an isolated port, verify `/health`, then verify a critical auth path)
- For each production or QA-found defect, add a regression test in the same change set as the fix
- If frontend tests mock network calls, pair them with backend real-HTTP checks so service availability and endpoint wiring are still validated

## Tooling Transition
- The legacy React/Parcel frontend has been removed. All frontend development targets `apps/web/` (Next.js).
- Future frontend implementation work should follow the target stack in `docs/TECH_STACK.md`.
- Frontend tests should use Vitest and Testing Library for unit/integration and Playwright for end-to-end customer journeys.

## Current Command Baseline
- Backend tests run with `npm run test:backend`.
- Target web end-to-end tests run with `npm run test:web:e2e`.
- Full repo regression checks for day-to-day development remain `npm test` plus `npm run test:runtime-smoke`.
- When changing `apps/web` authentication or dashboard flows, run `npm run test:web:e2e` before merge.

## Scope Management
- Maintain a clear list of active, deferred, and deprecated flows in product documentation.
- Deprecated flows should have lightweight contract tests proving they remain unavailable or explicitly deprecated.
- Do not include deprecated flows in customer-journey E2E suites.
- When a deferred flow is reactivated, update acceptance criteria, API docs, BDD scenarios, and tests in the same change.

## Customer-Centric Testing
- Write acceptance criteria from the user's perspective
- Use real-world data and scenarios in tests, with UK-realistic financial examples for the default market scope
- Prioritize usability, accessibility, and error handling

## Continuous Improvement
- Review test coverage and effectiveness regularly
- Add/adjust tests based on production issues and customer feedback
- Feed learnings from retrospectives into this strategy and `docs/task_completion_automation.md` in the same iteration they are discovered

## CI Quality Gate Restoration Plan
- Current state: lint and prettier checks are non-blocking advisory checks in CI during migration work.
- Goal state: lint and prettier are blocking required checks for pull requests.
- Restoration steps:
   1. Baseline formatting and lint debt in active source directories.
   2. Apply targeted cleanup batches by area (backend, frontend, docs) with no behavior changes.
   3. Keep lint/prettier scoped to active project paths while debt is reduced.
   4. Switch `continue-on-error` off for both checks once cleanup batches are complete.
   5. Enforce as required branch-protection checks after two stable PR cycles.

---

**All contributors must follow this strategy. Updates should be proposed via pull request.**
