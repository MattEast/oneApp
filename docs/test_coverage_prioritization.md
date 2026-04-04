# Test Coverage & Prioritization

This document reflects the current prototype scope. Deprecated flows are kept under explicit deprecation tests rather than customer-success tests.

## Registration Endpoint
| Test Description                                 | Complexity | Impact |
|--------------------------------------------------|------------|--------|
| Returns 400 if fields are missing                |     1      |   3    |
| Returns 400 if email is invalid                  |     1      |   3    |
| Returns 400 if password is too short             |     1      |   3    |
| Returns 201 with a JWT if registration succeeds  |     2      |   3    |
| Returns 409 if the email already exists          |     2      |   3    |

## Login Endpoint
| Test Description                                 | Complexity | Impact |
|--------------------------------------------------|------------|--------|
| Returns 400 if fields are missing                |     1      |   3    |
| Returns 400 if email is invalid                  |     1      |   3    |
| Returns 400 if password is missing               |     1      |   3    |
| Returns 401 if credentials are invalid           |     2      |   3    |
| Returns 200 and JWT if credentials are valid     |     2      |   3    |

## Password Reset Endpoint
| Test Description                                         | Complexity | Impact |
|----------------------------------------------------------|------------|--------|
| 410 deprecation response for reset request               |     1      |   3    |
| 410 deprecation response for unknown email               |     1      |   3    |
| 410 deprecation response for valid email                 |     1      |   3    |
| 410 deprecation response for missing token               |     1      |   3    |
| 410 deprecation response for short new password          |     1      |   3    |
| 410 deprecation response for invalid token               |     1      |   3    |
| 410 deprecation response for valid-looking confirmation  |     1      |   3    |

## Session Management Endpoint
| Test Description                                 | Complexity | Impact |
|--------------------------------------------------|------------|--------|
| Deny access to /account without token            |     2      |   3    |
| Allow access to /account with valid token        |     2      |   3    |
| Allow access to /dashboard-summary with token    |     2      |   3    |
| Logout returns stateless acknowledgement         |     1      |   2    |

## Dashboard Overview
| Test Description                                 | Complexity | Impact |
|--------------------------------------------------|------------|--------|
| Dashboard view loads summary data after auth     |     2      |   3    |
| Dashboard view shows failure state on API error  |     2      |   3    |
| Dashboard shows safe empty states                |     2      |   2    |
| Dashboard supports one-time entry CRUD flows     |     3      |   3    |

## Mocked Bank Linking
| Test Description                                                | Complexity | Impact |
|-----------------------------------------------------------------|------------|--------|
| Returns mocked bank-sync status for authenticated user          |     2      |   3    |
| Creates mocked bank link successfully                           |     2      |   3    |
| Ingests mocked transactions with duplicate and partial handling |     3      |   3    |
| Rejects invalid mock-link and ingest payloads                   |     2      |   3    |

## Recurring Obligations
| Test Description                                                | Complexity | Impact |
|-----------------------------------------------------------------|------------|--------|
| Returns no recurring obligations without linked history         |     2      |   2    |
| Detects recurring obligations from booked linked transactions   |     3      |   3    |
| Recalculates dashboard totals from detected obligations         |     3      |   3    |

## One-Time Entries
| Test Description                                                | Complexity | Impact |
|-----------------------------------------------------------------|------------|--------|
| Creates, lists, updates, and removes one-time entries          |     3      |   3    |
| Rejects invalid one-time entry payloads                        |     2      |   3    |
| Recalculates dashboard totals from one-time entries            |     3      |   3    |

## Deprecated Account Management Endpoints
| Test Description                                 | Complexity | Impact |
|--------------------------------------------------|------------|--------|
| Profile update returns deprecation response      |     2      |   2    |
| Password change returns deprecation response     |     2      |   2    |

- See test files in `backend/` for implementation details.
- See OpenAPI spec for request/response details.
