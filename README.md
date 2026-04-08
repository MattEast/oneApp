# OneApp

Personal finance management application.

## Structure

- **backend/** — Express API (Node.js, Prisma, PostgreSQL)
- **frontend/** — React SPA (Parcel bundler)
- **docs/** — Architecture docs, ADRs, OpenAPI spec

## Quick Start

```bash
npm install                 # install all workspace dependencies
cd backend && npx prisma migrate deploy && cd ..  # apply DB migrations for local dev
npm run dev:backend         # start backend server
npm run dev:frontend        # start frontend dev server
```

## Testing

```bash
npm test                    # run all tests (backend + frontend)
npm run test:backend        # backend only
npm run test:frontend       # frontend only
npm run test:runtime-smoke  # starts both services and verifies live login/connectivity
```

See [docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md) for details.
