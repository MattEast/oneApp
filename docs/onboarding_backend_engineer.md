# Backend Engineer Onboarding (Junior/Trainee)

## Role Purpose
Implement secure, well-tested API behavior that follows the OpenAPI contract and supports phased migration from prototype to target platform.

## What You Own
- API route behavior in backend/
- Input validation, auth checks, and clear error responses
- Service and data-layer logic under backend/services and backend/data
- Backend tests for all changes
- Contract-first updates aligned with docs/openapi.yaml

## Current vs Target Stack
- Current implementation: Express + Jest in backend/
- Target stack direction: NestJS + TypeScript + Prisma + PostgreSQL + worker separation
- Rule: keep current APIs reliable while preparing boundaries for migration

## First Week Outcomes
1. Run backend locally and execute full tests.
2. Trace one endpoint from route to service to tests.
3. Deliver one low-risk improvement with full test coverage.
4. Update contract/test/docs together in one PR.

## Local Setup
Run from repository root:

1. npm install
2. npm run dev:backend
3. npm run test:backend
4. npm run lint:contracts

Optional direct backend commands:
- cd backend && npm install && npm start
- cd backend && npm test

## Day-to-Day Checklist
- Start only from a documented story/sub-task.
- Confirm API behavior against docs/openapi.yaml before coding.
- Add validation and explicit error responses for boundary inputs.
- Keep auth behavior aligned with architecture rules in docs/README.md.
- Update tests in the same PR as code changes.

## Coding Standards
- Keep route handlers thin; put logic in service modules.
- Return consistent status codes and messages.
- Avoid implicit behavior not covered by tests.
- Preserve deprecated-route contracts until backlog says otherwise.

## Testing Expectations
For each backend change, include:
- Happy path test
- Validation/error path test
- Auth/permission check where relevant

Run before PR:
- npm run test:backend
- npm run lint:contracts (if endpoint contract changed)

## Common Pitfalls to Avoid
- Changing response shape without contract update
- Adding routes outside planned scope
- Skipping regression tests for bug fixes
- Coupling prototype code too tightly to a single future provider

## Suggested Starter Tasks
- Improve consistency of API error payloads
- Add missing validation coverage on high-traffic routes
- Refactor duplicated service logic behind helper functions
- Strengthen smoke checks for startup/auth critical paths

## PR Requirements
- Branch format: story/<id>-<slug> or fix/<id>-<slug>
- Include API contract impact section in PR
- Attach test output summary
