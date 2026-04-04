# Phased Delivery Roadmap

## Goal

Sequence delivery so the team can build a trustworthy financial product without letting incomplete flows become customer promises.

## Phase 1: Foundation and Realignment

- Confirm target architecture and delivery constraints
- Stabilize documentation as the source of truth
- Keep deprecated auth/account flows explicitly unavailable
- Finalize acceptance criteria for core stories
- Establish scope, roadmap, and API-contract ownership

## Phase 2: Platform Setup

- Set up the target monorepo and shared tooling
- Establish target frontend, backend, and worker application structure
- Configure target testing stack, CI, and environment management
- Establish contract-first API workflow and documentation discipline

## Phase 3: Auth Journey Rebuild

- Rebuild registration and login to match target-state behavior
- Implement duplicate-email handling, session lifecycle, and protected-route behavior
- Reintroduce only those auth flows that satisfy BDD scenarios, API docs, and tests together
- Keep account management and password reset behind redesign gates until ready

## Phase 4: Financial Data Foundation

- Establish initial bank-account connectivity and ingestion foundations
- Implement recurring payment detection from linked bank-account data
- Implement one-time expenses and income
- Establish categorization model and persistence rules
- Expose dashboard-ready summary data with source freshness and reconciliation visibility

## Phase 5: Budgeting and Insight Core

- Implement available-funds calculation
- Implement daily spending limits
- Implement initial dashboard overview and category grouping
- Add reports based on stable categorized financial data

## Phase 6: Notifications and Fixed-Term Tracking

- Implement reminder scheduling and delivery
- Implement fixed-term agreement tracking
- Add user-facing status for reminders and upcoming term events

## Phase 7: Security Maturity and External Integration

- Strengthen security controls, auditability, and operational monitoring
- Define anonymized-data eligibility, vault controls, owner consent, and sharing governance
- Expand stable integration boundaries and provider coverage for bank integrations
- Expand bank-linked data ingestion only after the platform can safely ingest, reconcile, and monitor external data at production quality
- Introduce any owner-approved commercial data-sharing capability only after anonymization, consent, revocation, and compliance controls are proven

## Delivery Rules

- Do not reactivate deprecated flows outside the documented reactivation criteria
- Add new work to the backlog before implementation begins; do not treat undocumented work as in-scope delivery
- Each phase must update acceptance criteria, API docs, tests, and scope status together
- If a feature is not customer-ready, document it as planned or deprecated rather than partially shipping it
- Resolve ambiguity against the current source of truth first; if the answer would change requirements or scope, pause for an explicit decision rather than guessing
- Changes to documented requirements require agreement from at least two parties: the product or requirement owner and an engineering or delivery reviewer
