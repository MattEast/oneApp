# OneApp

Personal finance management application.

## Structure

- **backend/** — Express API (Node.js, Prisma, PostgreSQL)
- **apps/web/** — Next.js customer web application (target stack)
- **docs/** — Architecture docs, ADRs, OpenAPI spec
- **packages/** — Shared config, contracts, UI components

## Quick Start

```bash
npm install                 # install all workspace dependencies
cd backend && npx prisma migrate deploy && cd ..  # apply DB migrations for local dev
npm run dev:backend         # start backend server
npm run dev:web             # start Next.js web app on port 3001
```

## Testing

```bash
npm test                    # run all tests (backend)
npm run test:backend        # backend only
npm run test:web:e2e        # Playwright e2e for apps/web
npm run test:runtime-smoke  # starts backend and verifies live login/connectivity
```

See [docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md) for details.
