# Onboarding Manager Progress Matrix (Week 1-4)

## Purpose
Use this matrix to track progress for junior/trainee hires across the four engineering roles:
- Front-end Engineer
- Back-end Engineer
- DevOps Engineer
- Test Automation Engineer

This matrix is aligned to the current prototype delivery phase and target platform migration path.

## How To Use
1. Set a named trainee for each role.
2. Review expected outcomes weekly.
3. Mark status: Not Started / In Progress / Complete.
4. Capture evidence links (PRs, test runs, docs updates).
5. Flag blockers and assign a mentor action.

## Week 1: Environment + Baseline Understanding

| Role | Expected Outcomes | Evidence | Status | Blockers / Mentor Action |
|---|---|---|---|---|
| Front-end | Run frontend/backend locally, understand login/dashboard flows, complete one small UI fix with tests | PR link + `npm run test:frontend` output |  |  |
| Back-end | Run backend tests, trace one endpoint end-to-end, complete one small API fix with tests | PR link + `npm run test:backend` output |  |  |
| DevOps | Understand active workflows, reproduce CI locally via root scripts, document one pipeline risk | PR/notes link |  |  |
| Test Automation | Run full suites, map one user journey to tests, identify one high-risk coverage gap | Notes + proposed test tasks |  |  |

## Week 2: Quality and Delivery Discipline

| Role | Expected Outcomes | Evidence | Status | Blockers / Mentor Action |
|---|---|---|---|---|
| Front-end | Deliver one story/sub-task with acceptance criteria met; include success + failure state tests | PR + test output |  |  |
| Back-end | Deliver one contract-aligned endpoint/task; update code + tests + docs together | PR + contract/test diff |  |  |
| DevOps | Improve one CI reliability issue; add a preventative guardrail/check | PR + workflow run link |  |  |
| Test Automation | Add one regression test tied to a bug entry in `docs/bugs.csv` | PR + bug ID reference |  |  |

## Week 3: Cross-Functional Collaboration

| Role | Expected Outcomes | Evidence | Status | Blockers / Mentor Action |
|---|---|---|---|---|
| Front-end | Collaborate with backend on one integrated flow and API error handling quality | PR + demo notes |  |  |
| Back-end | Support frontend with stable payloads and clear error contracts; reduce ambiguous behavior | PR + contract alignment notes |  |  |
| DevOps | Coordinate with all roles to keep required checks green and non-flaky | CI dashboard snapshot |  |  |
| Test Automation | Improve one end-to-end journey test plan and strengthen smoke-check coverage | Test plan + PR |  |  |

## Week 4: Independent Delivery Readiness

| Role | Expected Outcomes | Evidence | Status | Blockers / Mentor Action |
|---|---|---|---|---|
| Front-end | Independently ship a small user-facing story with complete PR checklist and test evidence | PR + reviewer sign-off |  |  |
| Back-end | Independently ship a small API story with contract-first workflow followed fully | PR + `npm run lint:contracts` output |  |  |
| DevOps | Independently complete one CI/CD or runbook improvement with measurable impact | PR + before/after notes |  |  |
| Test Automation | Independently add a regression/smoke improvement that catches a realistic failure mode | PR + failing-then-passing evidence |  |  |

## Role-Specific Readiness Signals

### Front-end Engineer
- Can implement accessible form and dashboard changes without breaking existing flows.
- Consistently includes frontend tests and meaningful error-state handling.

### Back-end Engineer
- Can deliver contract-aligned API changes with robust validation and tests.
- Uses service-layer boundaries and avoids route-level logic sprawl.

### DevOps Engineer
- Can debug and stabilize workflows quickly.
- Can add safe automation guardrails without blocking delivery unnecessarily.

### Test Automation Engineer
- Can translate defects and acceptance criteria into reliable regression checks.
- Can balance mock-based and real-HTTP/process-level coverage where appropriate.

## Escalation Triggers
Escalate to mentor/lead if any of the following persist for more than one week:
- Repeated PR rework for missing tests or acceptance criteria gaps
- Inability to run local environment and baseline scripts
- Frequent CI breakages introduced by the same contributor
- Repeated scope drift away from documented stories

## Weekly Review Template
- Wins this week:
- Risks this week:
- Coverage or quality improvements made:
- Main blocker:
- Support needed next week:
