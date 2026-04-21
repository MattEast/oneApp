# Scope Matrix

This matrix shows how each major product area should be interpreted during planning and delivery.

| Area | Current Status | Notes |
|------|----------------|-------|
| Registration and login | Foundation / partial prototype | Backend prototype endpoints remain active; Next.js register/sign-in screens authenticate against the current API; legacy React/Parcel frontend removed; full target-state lifecycle and account-management redesign remain planned work. |
| Auth lifecycle | Foundation / active prototype | Login, protected routes, invalid-session handling, and current-device sign-out are active; token expiry is stored on login (expiresAt in localStorage); SessionGuard wraps all authenticated pages — redirects on missing/expired token, shows 5-minute expiry warning banner; password reset and account changes remain deferred. |
| Dashboard overview | Foundation / partial prototype | Dashboard summary, due-soon reminders, recurring-data source state, and one-time entry management are active via the Next.js authenticated dashboard shell consuming dashboard-summary data from the versioned API; legacy React/Parcel frontend removed; fuller target-state dashboard behaviour remains planned work. |
| Category grouping | Foundation / partial prototype | Prototype grouped categories exist in the signed-in dashboard, including sourced recurring obligations and one-time expense grouping; fuller target-state categorisation remains planned. |
| Recurring payments | Foundation / partial prototype | Read-only recurring-obligation detection from mocked linked bank data is active in the prototype dashboard and API; the old manual CRUD scaffold is deprecated in code. |
| One-time expenses and income | Foundation / partial prototype | Authenticated one-time entry CRUD and dashboard recalculation are active in the prototype; budgeting follow-on work remains planned. |
| Available funds calculation | Foundation / partial prototype | Basic income-minus-bills-minus-flexible calculation exists in the prototype dashboard; daily spending limit now active; fuller target-state budgeting remains planned. |
| Daily spending limit | Foundation / partial prototype | Daily limit derived from available funds ÷ remaining period days; displayed on the Next.js dashboard; formula version `daily_limit_v1`. |
| Fixed-term agreements | Target-state planned | Depends on bank-sourced recurring obligations, sourced agreement detection, and reminder capabilities. |
| Payment reminders | Target-state planned | Depends on financial input, scheduling, and notification infrastructure. |
| Spending reports | Target-state planned | Depends on accurate categorized historical data. |
| Data security | Active cross-cutting concern | Must be addressed across every phase, not left to a final hardening step. |
| Anonymized data vault and sharing | Later-stage target-state | Requires strong anonymization rules, owner consent, auditability, and compliance controls before any commercial data-sharing model is enabled. |
| Bank account integration | Foundation / active prototype | Mocked bank-link status, link, and ingestion APIs exist for development and tests; provider adapter contract, TrueLayer consent flow, live sync pipeline, consent/callback/sync/disconnect routes, and consent-flow tests are now delivered; CSV ingestion pipeline parity verified; incremental sync orchestration delivered; banking configuration UI delivered in apps/web — connect/status/disconnect flows with guided onboarding, OAuth callback handling, dashboard CTA, and Playwright E2E tests; CSV import UI delivered in apps/web at /import with multipart statement upload, import-history visibility, and end-to-end coverage for success/error/partial-success states; webhook freshness slice delivered — see Real-time bank connectivity. |
| Real-time bank connectivity | Foundation / active prototype | Provider-agnostic adapter contract documented and implemented; TrueLayer provider integrated; OAuth consent onboarding, callback token exchange, live transaction sync, and consent revocation routes delivered; sync job orchestrator with queued jobs, exponential retry/backoff, dead-letter escalation, checkpoint-based incremental sync, and idempotent transaction ingestion delivered; mixed-source recurringDataSource.kind (bank_linked/csv_import/mixed) supported in dashboard; banking configuration UI in apps/web connects the full frontend-to-backend flow; consent-flow, route-level, orchestration, and pipeline-parity tests passing; Playwright E2E tests cover connect/status/disconnect/callback/dashboard-CTA; webhook-triggered freshness delivered — TrueLayer HMAC webhook handler, replay deduplication via recentWebhookEventIds, freshness metadata (status/lagMinutes/lastSuccessfulSyncAt/lastWebhookAt) exposed in live-status and dashboard-summary, banking page freshness card, fallback polling sweep for stale linked profiles, OpenAPI contract updated and synced, 7 focused backend suites and 7 banking Playwright tests passing; operational observability remains planned. |

## Status Definitions

- `Foundation / partial prototype`: some prototype behavior exists, but not a complete customer-ready journey.
- `Deprecated / redesign`: behavior has been intentionally disabled or marked unavailable until redesign is complete.
- `Planned next`: appropriate for near-term sequencing once foundation work is stable.
- `Target-state planned`: part of the intended product vision, but not ready for immediate delivery.
- `Active cross-cutting concern`: applies to all phases and should be visible in every design and delivery decision.
