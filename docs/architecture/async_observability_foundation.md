# Async Job And Observability Foundation

## Story Scope
Platform Setup: Async job and observability foundation.

## Worker Boundary Definition
Background workloads that should run in `apps/worker`:
- Reminder scheduling and retry execution
- Bank sync ingestion/reconciliation and retry handling
- Reporting and snapshot generation

Workloads that should remain in request-response APIs:
- Authentication and session requests
- Lightweight read operations for dashboard/account data
- Fast validation and command acceptance endpoints

## Queue And Retry Baseline
- Queue model: job queues per domain (`reminders`, `bank-sync`, `reporting`)
- Retry strategy: exponential backoff with capped delay
- Dead-letter strategy: move to dead-letter handling after max attempts
- Idempotency: every job requires a stable business idempotency key
- Failure visibility: terminal failures must emit structured logs and alerting signals

Reference policy file:
- `apps/worker/src/queue/retry-policy.json`

## Target Observability Tooling Baseline
- Structured logs: JSON logs from web/API/worker with consistent event names
- Error tracking: Sentry (frontend + backend + worker error capture)
- Tracing and metrics: OpenTelemetry instrumentation exported to managed backend
- Health signals: endpoint and worker heartbeat checks with deploy-time gating
- Alerting: threshold and anomaly alerts for auth failures, queue backlogs, and terminal job failures

## Prototype vs Target-State Monitoring
| Area | Current Prototype | Target State |
|---|---|---|
| Logging | Lightweight structured logs in backend auth/financial flows | Unified structured logging across web, API, worker, and infra context |
| Error tracking | Basic console/log-driven triage | Centralized Sentry with release tagging and ownership routing |
| Tracing | Not implemented | OpenTelemetry traces across API requests and background jobs |
| Queue visibility | Not implemented (worker runtime pending) | Queue depth, retry, and dead-letter dashboards with alerting |
| Health checks | API process startup logs and ad hoc checks | Standard health endpoints and worker heartbeats enforced in delivery checks |

## Delivery Guardrails
- New background workloads must document queue, retry, and dead-letter behavior before implementation merges.
- Any new worker processor must emit structured lifecycle logs (`started`, `retrying`, `succeeded`, `failed_terminal`).
- Observability requirements for new stories must state what is prototype-only versus target-state complete.
