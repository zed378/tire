# Commercial 2026 — Bus & Truck Tire Data System

The full specification lives in `PLAN/`. Those documents are binding: where the
code and a document disagree, the document is right. Do not copy `PLAN/` content
into this file.

Reading order when in doubt: `PLAN/03` (domain rules) -> `PLAN/05` (API
contract) -> `PLAN/02` + `PLAN/11` (schema). `PLAN/11` supersedes `PLAN/02` for
the vehicle / inspection tables.

## Commands
- `pnpm verify`     — typecheck + lint + tests + forbidden-pattern + rule-sync gates.
                      Must be green before any task is considered done.
- `pnpm test:axle`  — the axle configuration engine only.
- `pnpm db:migrate` — migrations. Do NOT use `prisma migrate dev`.
- `pnpm db:seed`    — master data and the first admin account.

## Before writing any code
1. Read the `PLAN/` section the task names.
2. If the task names no document, STOP and ask.
3. If the document is ambiguous, STOP and ask. Do not guess.

## Absolute rules
- NEVER write `alert()`, `confirm()`, or `prompt()`. The legacy system used
  them; that is defect D-08, the very thing this rewrite fixes.
- Every client-facing handler returns the `PLAN/05` §2 envelope, errors
  included. No per-route `try/catch` — the wrapper handles it.
- Every validation rule is enforced on the server. Client validation is
  convenience only.
- Validation schemas are written ONCE in `packages/contracts` and imported by
  both sides. Never duplicate a validation rule. The plate-number regex exists
  only in `packages/contracts/src/vehicle.ts`.
- `kernel/` must not import anything from `modules/`.
- `kernel/axle/` is pure logic: no I/O, no imports at all.
- A module calls another module's service layer (`modules/x/index.ts`), never
  its repository.
- Business data is never hard-deleted. Use `deleted_at`.
- Inspection status changes ONLY through `transitionInspection()`. There is no
  `UPDATE inspections SET status = ...` anywhere else.
- Every status change writes an audit entry in the same transaction: actor,
  time, before and after values.
- Notifications are written to `outbox` inside the same transaction as the data
  change. Never call a sender directly from domain code.
- Credentials, tokens, and connection strings come only from environment
  variables.

## Style
- Write boring code. Clarity beats brevity, always.
- Do not build an abstraction for two callers. Three similar lines beat one
  premature abstraction.
- **English for all identifiers, file names, directory names, and comments** —
  including domain concepts (`inspection`, `tirePosition`, `axle`, `vehicle`).
- **Indonesian for every string a user sees**, error and validation messages
  included (`K-10`). That split is deliberate: the field users are Indonesian,
  the codebase is not.
- Dates render as `dd/mm/yyyy` in WIB. Stored as `timestamptz` in UTC.
- TypeScript `strict`. No `any`. No `@ts-ignore`.

## Done means
`pnpm verify` is green. Do not disable a lint rule to get there. If a lint rule
blocks you, that is a signal the design is wrong — not that the rule is wrong.
