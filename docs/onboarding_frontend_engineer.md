# Frontend Engineer Onboarding (Junior/Trainee)

## Role Purpose
Build clear, accessible, and trustworthy customer journeys in the web application, starting from the active prototype and gradually moving to the target stack.

## What You Own
- Customer-facing pages and flows in frontend/
- Form validation, error handling, and loading states
- Accessibility and usability of interactions
- Frontend tests for new and changed behavior
- Contract alignment with API responses documented in docs/openapi.yaml

## Current vs Target Stack
- Current implementation: React + Parcel + Jest in frontend/
- Target stack direction: Next.js + TypeScript + Testing Library + Vitest
- Rule: deliver value in current prototype while avoiding patterns that block migration

## First Week Outcomes
1. Run the app and understand the auth + dashboard flow.
2. Make one small UI improvement with tests.
3. Read the API contract and map one endpoint to UI behavior.
4. Open one PR using branch naming rules and checklist.

## Local Setup
Run from repository root:

1. npm install
2. npm run dev:backend
3. npm run dev:frontend
4. npm run test:frontend

Demo credentials are listed in docs/README.md.

## Day-to-Day Checklist
- Start from an approved story in docs/jira_import_aligned.csv.
- Confirm acceptance criteria before coding.
- Keep copy and behavior UK-first (GBP, UK English, Europe/London assumptions).
- Add/update tests for every change.
- Validate error and empty states.
- Verify keyboard and screen-reader-friendly behavior.

## Coding Standards
- Keep components small and focused.
- Prefer explicit state names over clever abstractions.
- Avoid hard-coded API shapes not backed by docs/openapi.yaml.
- Keep deprecated flows deprecated unless explicitly reactivated.

## Testing Expectations
For each UI change, include:
- Component/flow test updates in frontend/__tests__/
- Success path and failure path coverage
- At least one accessibility assertion when relevant

Run before PR:
- npm run test:frontend
- npm run lint:contracts (if API shape or usage changed)

## Common Pitfalls to Avoid
- Building UI for deferred/deprecated scope without backlog approval
- Assuming backend fields that are not in docs/openapi.yaml
- Skipping error-state UX for network failures
- Merging behavior without test updates

## Suggested Starter Tasks
- Improve form validation messaging consistency
- Tighten loading/error states for account/dashboard calls
- Add accessibility checks to existing high-traffic flows
- Remove duplicated UI logic into shared helper components

## PR Requirements
- Branch format: story/<id>-<slug> or fix/<id>-<slug>
- Include story details and acceptance criteria in PR body
- Include test evidence and screenshots when UI changes
