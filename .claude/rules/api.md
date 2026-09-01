---
description: Server-side rules
paths: ["apps/api/src/**/*.ts"]
---

# API Rules (PLAN/05, PLAN/04)

- The `PLAN/05` §2 envelope wraps **every** response, success or failure.
  Handlers return raw data; `wrapRoute()` builds the envelope.
- No `try/catch` inside route handlers. Throw an `AppError` or let it bubble;
  the wrapper maps it.
- Authorisation on **every** route via `requirePermission(...)`, not only in
  the UI. Hiding a menu is not enforcement (`K-07`).
- Data scoping goes through `inspectionScope(actor)` / `vehicleScope(actor)`.
  Never rewrite a scope condition inline in a new query — that is exactly
  where authorisation leaks are born (`PLAN/04` §2.2).
- A resource outside the caller's scope answers `404`, never `403`.
- `requestId` is created at the start of the request and flows into every log
  line, `audit_logs.request_id`, `outbox.request_id`, and the response.
- Raw exceptions, stack traces, and PostgreSQL messages never reach the
  browser. Translate them via `translateDatabaseError()`.
- Passwords, session tokens, TOTP secrets, and recovery codes never enter the
  logs — including error logs (`PLAN/13` §8).
- The data change, the audit entry, and the outbox row live in **one**
  transaction.
