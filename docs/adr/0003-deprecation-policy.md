# ADR 0003: Deprecate Mismatched Prototype Flows

## Status
Accepted

## Context
Several prototype auth and account-management flows did not match the intended customer design and were creating documentation drift and false delivery signals.

## Decision
Deprecate mismatched flows rather than extend them. Keep them unavailable until redesign, documentation, API contract, and tests are aligned.

## Consequences
- Deprecated endpoints and UI flows must remain clearly marked in code and docs.
- Current-scope status must be documented separately from target-state behavior.
- Teams should prefer explicit unavailability over partial customer journeys.
