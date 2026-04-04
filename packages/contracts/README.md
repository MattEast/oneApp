# packages/contracts

Shared API contract workspace.

Current source of truth:
- docs/openapi.yaml

Shared artifact home:
- packages/contracts/openapi/openapi.yaml

Workflow:
1. Update `docs/openapi.yaml` first.
2. Sync shared artifact: `npm --prefix packages/contracts run sync:openapi`
3. Validate and check drift: `npm run lint:contracts`

Deprecation and versioning expectations:
- Deprecating or removing endpoints must be called out in changelog/release notes and reflected in contract changes before implementation ships.
- Breaking contract changes require an explicit versioning plan and must not be merged without updating affected tests.

Planned responsibilities:
- Generated TypeScript types for request and response payloads
- Shared API client artifacts for web and worker consumers
- Contract validation checks in CI
