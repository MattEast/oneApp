# Platform Setup Bootstrap

This document defines the initial target monorepo foundation while preserving the active prototype.

## Repository Layout

- apps/web: target customer web app boundary (Next.js, planned)
- apps/api: target API boundary (NestJS, planned)
- apps/worker: target background job boundary (planned)
- packages/contracts: shared API contract and generated artifacts boundary
- packages/ui: shared UI component and token boundary
- packages/config: shared lint, test, and tool config boundary
- infra: infrastructure-as-code boundary
- backend: active prototype API implementation (current)
- frontend: active prototype frontend implementation (current)

## Bootstrap Commands

Run from repository root.

1. Install dependencies for all workspaces:

   npm install

2. Start active prototype backend:

   npm run dev:backend

3. Start active prototype frontend:

   npm run dev:frontend

4. Run current test suites:

   npm run test:backend
   npm run test:frontend

5. Run baseline contract validation check:

   npm run lint:contracts

## Environment Notes

- Active prototype API port: 4000
- Active prototype frontend port: 3000
- Current local demo account is documented in docs/README.md
- The new apps/* and packages/* directories are scaffold boundaries only and do not replace backend/ or frontend/ yet.

## Shared Configuration Boundaries

- Product API contract remains authored in docs/openapi.yaml.
- Contract checks are initiated through packages/contracts/scripts/validate-openapi.js.
- Shared linting, test, and TypeScript base config will be centralized in packages/config as migration stories progress.

## Migration Guardrails

- Do not remove or break backend/ and frontend/ until replacement paths are documented and tested.
- Any route or schema change must update docs/openapi.yaml and tests in the same change.
- Keep deprecated prototype flows explicitly deprecated until redesign criteria are met.
