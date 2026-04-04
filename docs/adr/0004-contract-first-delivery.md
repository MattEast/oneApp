# ADR 0004: Contract-First Delivery

## Status
Accepted

## Context
The project needs strong alignment between product intent, engineering delivery, and testing. Drift between docs and behavior has already created risk.

## Decision
Use contract-first delivery for customer-facing flows: acceptance criteria, BDD scenarios, API contracts, and tests must be updated together.

## Consequences
- A feature is not considered complete if only code changes exist.
- API and scope documentation become part of the delivery checklist.
- Story-level acceptance criteria must be explicit enough for both developers and testers.
