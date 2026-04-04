# ADR 0002: Auth Strategy and Managed Identity Abstraction

## Status
Accepted

## Context
Authentication and session management must be secure, testable, and replaceable without locking the product to one provider-specific implementation.

## Decision
Design authentication behind a provider abstraction and target managed OIDC-compatible identity rather than embedding product logic directly into a single auth SDK.

## Consequences
- Auth flows must be documented independently from prototype implementation details.
- Session lifecycle, reset flows, and account management should only be reintroduced when they satisfy the target auth design.
- API contracts and BDD scenarios must describe customer outcomes, not prototype shortcuts.
