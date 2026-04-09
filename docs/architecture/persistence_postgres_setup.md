# Durable Financial Persistence: PostgreSQL Setup

This project uses PostgreSQL for production-ready, durable storage of user and financial data. Prisma ORM is used for schema management and migrations.

## Local Development
- By default, use a local PostgreSQL instance (e.g., Docker, Homebrew, or system package).
- Example connection string (set in backend/.env):
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/oneapp_dev"

## Setup Steps
1. Install PostgreSQL locally (if not already installed).
2. Create a database:
   createdb oneapp_dev
3. Set DATABASE_URL in backend/.env
4. Run migrations:
   npx prisma migrate dev --schema=backend/prisma/schema.prisma
5. Generate Prisma client:
   npx prisma generate --schema=backend/prisma/schema.prisma

## Production
- Use a managed PostgreSQL service (AWS RDS, GCP Cloud SQL, Azure, etc.)
- Set DATABASE_URL accordingly.

## Schema Location
- See backend/prisma/schema.prisma for the relational schema.
- See docs/architecture/ for schema diagrams and documentation.

## ORM/Tooling
- Prisma ORM: https://www.prisma.io/
- PostgreSQL: https://www.postgresql.org/

---

For questions or troubleshooting, see the README or contact the platform team.
