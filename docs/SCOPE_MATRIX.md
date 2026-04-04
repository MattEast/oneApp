# Scope Matrix

This matrix shows how each major product area should be interpreted during planning and delivery.

| Area | Current Status | Notes |
|------|----------------|-------|
| Registration and login | Foundation / partial prototype | Backend prototype endpoints exist; full customer journey remains target-state work. |
| Auth lifecycle | Foundation / partial prototype | Login, protected routes, invalid-session handling, and current-device sign-out are active; password reset and account changes remain deferred. |
| Dashboard overview | Foundation / partial prototype | Prototype dashboard summary, due-soon reminders, recurring-data source state, and one-time entry management now exist; fuller target-state dashboard behaviour remains planned work. |
| Category grouping | Foundation / partial prototype | Prototype grouped categories exist in the signed-in dashboard, including sourced recurring obligations and one-time expense grouping; fuller target-state categorisation remains planned. |
| Recurring payments | Foundation / partial prototype | Read-only recurring-obligation detection from mocked linked bank data is active in the prototype dashboard and API; the old manual CRUD scaffold is deprecated in code. |
| One-time expenses and income | Foundation / partial prototype | Authenticated one-time entry CRUD and dashboard recalculation are active in the prototype; budgeting follow-on work remains planned. |
| Available funds calculation | Target-state planned | Depends on recurring and one-time financial data. |
| Daily spending limit | Target-state planned | Depends on available-funds calculation. |
| Fixed-term agreements | Target-state planned | Depends on bank-sourced recurring obligations, sourced agreement detection, and reminder capabilities. |
| Payment reminders | Target-state planned | Depends on financial input, scheduling, and notification infrastructure. |
| Spending reports | Target-state planned | Depends on accurate categorized historical data. |
| Data security | Active cross-cutting concern | Must be addressed across every phase, not left to a final hardening step. |
| Anonymized data vault and sharing | Later-stage target-state | Requires strong anonymization rules, owner consent, auditability, and compliance controls before any commercial data-sharing model is enabled. |
| Bank account integration | Foundation / partial prototype | Mocked bank-link status, link, and ingestion APIs now exist for development and tests; live provider sync remains planned work and still requires strong security and operational controls. |

## Status Definitions

- `Foundation / partial prototype`: some prototype behavior exists, but not a complete customer-ready journey.
- `Deprecated / redesign`: behavior has been intentionally disabled or marked unavailable until redesign is complete.
- `Planned next`: appropriate for near-term sequencing once foundation work is stable.
- `Target-state planned`: part of the intended product vision, but not ready for immediate delivery.
- `Active cross-cutting concern`: applies to all phases and should be visible in every design and delivery decision.
