# apps/worker

Target-state background job boundary.

Planned responsibilities:
- Reminder scheduling and retries
- Bank sync orchestration
- Report generation pipelines

Responsibilities that belong in worker (not request-response API):
- Scheduled reminders and follow-up delivery retries
- Long-running bank sync ingestion, reconciliation, and retry logic
- Report/snapshot generation that may exceed API request budgets

Queue and retry conventions:
- Jobs must be idempotent and keyed to a business identifier.
- Default retry policy is defined in `src/queue/retry-policy.json`.
- Failed jobs move to dead-letter handling after max attempts.
- Worker processors should emit structured logs for start, retry, success, and terminal failure.

Current scaffolding:
- `src/jobs/reminders.job.placeholder.js`
- `src/jobs/bank-sync.job.placeholder.js`
- `src/jobs/reporting.job.placeholder.js`
- `src/queue/retry-policy.json`

Current status:
- Placeholder scaffold only. No production job runner is active yet.
