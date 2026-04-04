# Technology Stack Decision

## Decision Summary

This project should be built as a TypeScript monorepo with:

- Next.js for the customer-facing web application
- NestJS for the backend API
- PostgreSQL as the primary relational database
- Prisma as the ORM and schema management layer
- Redis and BullMQ for background jobs and scheduled processing
- OpenAPI-first contracts with generated types and clients
- Managed OIDC-compatible authentication behind an adapter layer
- Playwright, Vitest, and Testing Library for the test pyramid
- GitHub Actions, Docker, and Terraform for delivery and operations

This recommendation is based on the documented product goals, user stories, wireframes, architecture requirements, and test strategy. It intentionally ignores any currently implemented stack choices and focuses on the best long-term technical fit.

## Primary Market Context

The default market assumption for planning and implementation is the United Kingdom.

- Customer-facing copy should use UK English.
- Monetary values should default to GBP, with storage and contract design that preserve precise minor-unit handling.
- Date and time handling should assume `Europe/London` unless a feature explicitly supports multi-region behaviour.
- Compliance and privacy decisions should be evaluated first against UK GDPR, the Data Protection Act 2018, ICO guidance, and any applicable FCA or Open Banking obligations for the active feature scope.

## Architecture Style

Use a modular monorepo with separate deployable applications and shared packages.

### Recommended Structure

- apps/web: Next.js application for customer UI
- apps/api: NestJS application for APIs and core business logic
- apps/worker: background job processor for reminders, sync, reporting, and scheduled tasks
- packages/ui: shared UI components and design tokens
- packages/contracts: OpenAPI-generated types, clients, and schema artifacts
- packages/config: shared lint, TypeScript, test, and tooling configuration
- infra: infrastructure as code, deployment configuration, and environment setup

## Frontend Stack

### Core

- Next.js
- React
- TypeScript

### UI and Styling

- Tailwind CSS for fast, consistent styling
- Radix UI for accessible primitives
- A thin internal design system in a shared package

### Forms and Validation

- React Hook Form for performant form state
- Zod for schema validation and request/response alignment

### Data and State

- TanStack Query for server state, caching, retries, and optimistic updates
- Minimal local state with React hooks

### Why This Frontend Stack

- Strong fit for form-heavy workflows such as registration, login, account management, payments, and settings
- Fast iteration for customer-facing features
- Good support for accessible, testable interfaces
- Clear path to scaling dashboards, reports, and authenticated user flows
- Supports consistent UK-first localisation patterns for currency, date handling, copy, and accessibility expectations

## Backend Stack

### Core

- NestJS
- TypeScript

### API

- REST APIs documented in OpenAPI
- Request and response validation at the boundary
- Versioned API strategy from the start
- Contracts should make UK assumptions explicit where relevant, including currency, locale-sensitive formatting rules, consent requirements, and regulated integration boundaries

### Data Layer

- PostgreSQL for transactional, relational financial data
- Prisma for migrations, typed queries, and schema management

### Jobs and Async Work

- Redis for ephemeral infrastructure needs
- BullMQ for scheduled reminders, bank sync processing, notifications, and report generation

### Why This Backend Stack

- Better long-term maintainability than a lightweight unstructured API layer
- Strong modular boundaries for identity, accounts, payments, notifications, reports, and integrations
- Good fit for scheduled work, auditability, and secure domain logic
- Supports a modular monolith approach now without committing to premature microservices

## Authentication and Security

### Authentication

- Use a managed OIDC-compatible identity provider
- Keep auth provider logic behind an adapter or service abstraction
- Avoid vendor lock-in by depending on claims, tokens, and standard interfaces instead of provider-specific application logic
- Select providers that can support UK residency, privacy, audit, and assurance expectations appropriate to the product scope

### Security Controls

- Short-lived access tokens and secure refresh/session handling
- Role-based access control where needed
- Encrypted secrets and environment management
- Audit logging for security-sensitive actions
- Secure-by-default validation on all external inputs
- Explicit review of UK GDPR, Data Protection Act 2018, ICO guidance, and any FCA/Open Banking responsibilities before production release of in-scope features

### Recommended Providers

Any provider selected must support OIDC, JWT/OAuth flows, MFA, password reset, and a migration path. Provider choice should be made later based on budget, geography, compliance, and operational fit.

## Integration Layer

### Banking and External Providers

- Use a dedicated bank aggregation provider rather than building raw bank integrations directly
- Recommended options depend on target market:
  - Plaid for North America
  - TrueLayer for UK and parts of Europe
  - Tink for broader European coverage
- For the default UK rollout path, prefer a provider strategy centered on UK Open Banking coverage, UK bank support, consent management, and re-authentication flows suitable for UK customers

### Notifications

- Email provider such as Postmark or SendGrid
- Background job orchestration for reminder scheduling and retries

## Testing Stack

### Unit and Component Tests

- Vitest for fast unit testing
- Testing Library for UI behavior and accessibility-focused component tests

### Integration and Contract Tests

- API integration tests against the NestJS application
- Contract testing driven from OpenAPI
- Database integration tests against disposable test environments

### End-to-End Tests

- Playwright for customer-journey tests covering registration, login, dashboard, payments, reminders, reports, and account management

### Why This Testing Stack

- Aligns with the documented fail-fast principle
- Supports testing through the customer's eyes
- Enables phased testing from unit to customer-beta validation
- Keeps high-confidence regression coverage on the most important journeys

## Observability and Operations

### Monitoring and Error Tracking

- OpenTelemetry for traces and metrics
- Sentry for frontend and backend error monitoring
- Centralized structured logging

### Delivery and Infrastructure

- GitHub Actions for CI/CD
- Docker for repeatable local and deployment environments
- Terraform for infrastructure as code
- AWS as the default hosting target unless product geography or compliance requirements dictate otherwise
- Prefer UK or UK/EU-aligned hosting, logging, backup, and data-processing arrangements where needed to satisfy the active release scope

## Delivery Principles Supported by This Stack

This stack supports the documented objectives by making it easier to:

- fail fast with fast local tests, typed contracts, and reliable CI
- automate where appropriate through contract generation, CI pipelines, and background workers
- test through the customer's eyes using Playwright and scenario-driven acceptance criteria
- get the product into customers' hands quickly using a monorepo, shared contracts, and production-grade defaults
- introduce a phased testing approach with clear boundaries between unit, integration, system, and beta testing

## Explicit Non-Goals

To avoid unnecessary complexity at this stage:

- Do not split into microservices initially
- Do not use NoSQL as the primary transactional store
- Do not bind business logic directly to a single identity vendor SDK
- Do not build custom bank connectivity from scratch where an aggregation provider exists

## Final Recommendation

Standardize on the following stack for planning and future implementation:

- Frontend: Next.js, React, TypeScript, Tailwind CSS, Radix UI
- Frontend support: React Hook Form, Zod, TanStack Query
- Backend: NestJS, TypeScript
- Data: PostgreSQL, Prisma
- Async processing: Redis, BullMQ
- Auth: Managed OIDC provider behind an adapter
- Testing: Vitest, Testing Library, Playwright, OpenAPI contract tests
- Delivery: GitHub Actions, Docker, Terraform
- Observability: OpenTelemetry, Sentry
- Hosting: AWS

This recommendation assumes a UK-first product baseline and must be complemented by explicit legal, privacy, and regulatory review for each production release scope.

---

Decision updated on 2026-04-03.
