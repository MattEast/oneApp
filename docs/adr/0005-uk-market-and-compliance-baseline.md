# ADR 0005: UK Market and Compliance Baseline

## Status
Accepted

## Context
The product currently contains broad financial-planning requirements, but it does not yet state clearly enough which market assumptions should drive customer experience, financial terminology, banking integrations, and compliance work.

## Decision
Treat the United Kingdom as the primary market baseline unless a requirement explicitly states otherwise.

- Customer-facing language should use UK English.
- Monetary values should default to GBP.
- Time and date handling should assume `Europe/London` for UK-facing features unless multi-region support is explicitly in scope.
- Banking integrations should prioritise UK Open Banking suitability and UK provider coverage.
- Privacy, security, and regulated-feature planning must be reviewed against UK GDPR, the Data Protection Act 2018, ICO guidance, and any applicable FCA or Open Banking obligations for the active release scope.
- Features must not be described as fully compliant or production-ready based on engineering implementation alone; explicit legal, privacy, and security review remains mandatory.

## Consequences
- Requirements, stories, API contracts, and tests should encode UK assumptions directly where relevant.
- Generic financial labels should be refined toward UK-understandable categories and terminology.
- Data handling, consent, and audit decisions need UK-specific documentation before regulated or sensitive features are released.
- Future multi-market support should be treated as additional scoped work rather than an implicit default.