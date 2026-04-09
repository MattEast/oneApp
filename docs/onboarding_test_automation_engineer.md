# Test Automation Engineer Onboarding (Junior/Trainee)

## Role Purpose
Protect customer journeys by building reliable automated tests that catch regressions early and keep delivery confidence high.

## What You Own
- Test design and automation quality across frontend and backend
- Regression tests for defects and high-risk flows
- Smoke checks for startup/auth critical paths
- Test strategy execution aligned with docs/TEST_STRATEGY.md
- Defect-to-test traceability using docs/bugs.csv

## Current vs Target Tooling
- Current prototype tooling: Jest for backend and frontend tests
- Target tooling direction: Vitest + Testing Library + Playwright
- Rule: strengthen current coverage while writing tests that can migrate cleanly

## First Week Outcomes
1. Run full test suites and understand current pass/fail signals.
2. Map one customer journey to existing tests and identify gaps.
3. Add one regression test tied to a documented defect.
4. Improve one smoke check around availability/auth behavior.

## Local Setup
Run from repository root:

1. npm install
2. npm run test:backend
3. npm run test:frontend
4. npm run lint:contracts

Helpful files:
- docs/TEST_STRATEGY.md
- docs/test_coverage_prioritization.md
- docs/bugs.csv

## Day-to-Day Checklist
- Start from acceptance criteria and user behavior, not just code branches.
- Keep tests readable and scenario-focused.
- Add failure-path assertions, not only happy paths.
- For every bug fix, add/adjust regression coverage in the same PR.
- Keep deprecated flows out of active customer-journey suites.

## Test Design Standards
- Prefer deterministic tests over timing-sensitive checks.
- Keep mocks minimal and realistic.
- Validate both payload shape and user-facing outcomes.
- Use explicit setup/teardown to avoid hidden coupling.

## Coverage Expectations
Each story should normally include:
- Unit/integration checks for changed logic
- Regression coverage for bug-prone paths
- Contract validation when API behavior changes
- Smoke checks for startup/login critical flow when relevant

## Common Pitfalls to Avoid
- Mocking all network behavior without any real-HTTP verification
- Treating flaky tests as acceptable noise
- Leaving bug tickets without a corresponding regression test
- Testing deprecated scope as if it were active behavior

## Suggested Starter Tasks
- Add missing negative-path assertions for auth and dashboard flows
- Improve test naming for readability and triage speed
- Add regression tags/comments linked to bug IDs
- Help define migration plan from Jest to Vitest/Playwright suites

## PR Requirements
- Branch format: story/<id>-<slug> or fix/<id>-<slug>
- Include test evidence section in PR body
- Document what risk is now covered by automation
