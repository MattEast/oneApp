# Precision-Safe Money Model

## Purpose
Define a precision-safe internal money representation for GBP calculations so dashboard and budgeting logic avoid floating-point drift.

## Internal Representation
- Internal money values use integer minor units (`amountMinor`) where 1 GBP = 100 minor units.
- Core fields now use minor units in storage and calculation paths:
  - `monthlyIncomeMinor`
  - `amountMinor` on recurring and one-time entries
  - derived totals computed in minor units before response serialization

## API Compatibility
- Existing API responses continue to expose `amount` values in GBP major units for compatibility.
- Major-unit values are derived from minor units at serialization boundaries.
- OpenAPI descriptions should state that major-unit response values are externally exposed while internal storage uses minor units.

## Calculation Rules
- All sums and formula operations must execute in minor units.
- Cadence conversions (for example four-weekly to monthly) are computed on minor units and rounded once per conversion.
- Only convert to major units for API output or customer-facing display.

## Migration Notes
- Profiles seeded with legacy major-unit fields are migrated in-memory on read:
  - `monthlyIncome` -> `monthlyIncomeMinor`
  - category/payment/entry `amount` -> `amountMinor`
- Migration is backward-compatible for prototype in-memory stores and should be mirrored in durable persistence migration stories.

## Follow-On Work
- Durable persistence story should persist money as integer minor units in relational schema.
- Versioned API story should decide whether to introduce explicit `amountMinor` fields in a future versioned contract.
