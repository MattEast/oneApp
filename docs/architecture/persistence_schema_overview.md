# Durable Financial Persistence: Schema Overview

This document describes the relational schema for durable user and financial data persistence in PostgreSQL.

## Tables

### User
- id (UUID, PK)
- email (unique)
- password (hashed)
- createdAt, updatedAt

### FinancialProfile
- id (UUID, PK)
- userId (FK, unique)
- monthlyIncomeMinor (int, minor units)
- referenceDayOfMonth (int)
- periodLabel (string)

### OneTimeEntry
- id (UUID, PK)
- profileId (FK)
- label, type, amountMinor, transactionDate, category, notes

### FlexibleCategory
- id (UUID, PK)
- profileId (FK)
- name, amountMinor, kind

### RecurringPayment
- id (UUID, PK)
- profileId (FK)
- label, amountMinor, cadence, paymentType, category, dueDay

## Notes
- All money fields use integer minor units for precision safety.
- User and financial profile are 1:1; entries and categories are 1:N.
- Schema is managed by Prisma ORM (see backend/prisma/schema.prisma).

---

For migration and seeding details, see the persistence setup doc.
