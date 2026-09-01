# Where this stands

Written by the agent that produced the implementation. It is not a sign-off —
`PLAN/09` §6 N-05 reserves that for the system owner. It is the honest input to
one.

## Gates, measured

| Gate | State | Evidence |
|---|---|---|
| G-01 typecheck, strict | pass | `pnpm typecheck` clean across four packages |
| G-02 lint + module boundaries | pass | `pnpm lint --max-warnings=0` clean |
| G-03 no `alert`/`confirm`/`prompt` | pass | 139 files scanned, zero hits |
| G-04 every `V-nn` has a test | pass | 14 rules in `PLAN/03` §4, 14 covered |
| G-05 axle engine 100% branches | pass | `packages/contracts/src/axle` at 100/100/100/100 |
| G-06 overall line coverage >= 70% | **not met** | see below |
| G-07 mutation score >= 85% on the axle engine | **not run** | Stryker is configured; needs one long run |
| G-08 no credentials in the repo | pass | 4 lines suppressed, each with a written reason |
| G-09 migrations apply to an empty database | pass | applied to an empty PostgreSQL 18; 33 tables, 23 CHECKs, 3 audit partitions, both constraint triggers, the generated `plate_key`, the partial locking index, and the materialised view all verified present |
| G-10 no demo panel, no hardcoded credentials | pass | zero hits |
| G-11 end-to-end QC flow | **not run** | needs a database and a seeded environment |
| G-12 client bundle <= 180 KB gzipped | pass | 148.8 KB |
| G-13 lockfile does not drift | pass | frozen install |

384 tests pass: 197 contracts, 157 API, 19 migration, 11 web.

The seed and the running application were exercised against that database:
six inspections covering every branch of the status machine, 70 generated
photographs, the host split enforced (`/api/qc/queue` answers 404 on the storage
hostname), and a signed photo URL returning a real 27 KB WebP while a token with
one character changed returns 404.

## G-06 is the one to look at

Overall API line coverage is 13%. The number is real and the config prints it on
every run rather than hiding it, because hiding it is the tempting move.

The cause is not laziness about tests. `apps/api/src/modules/**` is roughly two
thirds of the code and every service in it talks to PostgreSQL, so none of it is
reachable by a unit test. What it needs is an integration suite running against a
real database — which is phase acceptance work, and `PLAN/09` §6 N-05 puts the
accepting in human hands anyway.

What has been done instead of nothing:

- The unit-testable core carries real gates. The axle engine is at 100%. The
  error envelope, the authorisation layer, the password and TOTP handling, and
  the storage token signing all have thresholds they meet.
- The global threshold is a **ratchet**, set just under today's figure. It stops
  coverage falling and makes progress visible. It is raised as the integration
  suite lands, and the target is the 70% in `PLAN/08` §6.1.
- The one thing not done is narrowing the denominator to make the number look
  good. `apps/api/vitest.config.ts` says so at the top.

## What running it needs

```bash
cp .env.example .env          # works as-is for local
docker compose up -d          # postgres:18-alpine
pnpm install
pnpm --filter @c26/api prisma generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

G-07 (mutation) and G-11 (end-to-end) remain unrun. Until they have been, they
are untested claims rather than facts, and this document says so.

## Bugs found by running it, not by reading it

Eight defects that no amount of typechecking would have caught, and that were
only visible once the thing was actually used:

**Found by the system owner exercising the app**

1. **A transient failure logged the user out.** `RequireSession` read
   `user === null` from a query whose `data` was `undefined` because the request
   had FAILED — so a brief API restart during `pnpm verify` bounced them to the
   login screen, three times, with no explanation. "We could not ask" and "the
   answer is no" are now different states: the first shows a retry screen and
   keeps the user in place.
2. **Nothing could be enqueued.** The API writes to `pgboss.job` inside the
   caller's transaction, but the schema was created only when the worker first
   started. Every export and every photo confirmation answered 500 with
   `relation "pgboss.job" does not exist`.
3. **Nor could it after the schema existed.** pg-boss v10 partitions `job` by
   queue name, so the insert then failed with `no partition of relation "job"
   found for row`. `pnpm db:migrate` now installs the schema and a partition per
   queue, and the API refuses to start without them rather than failing on
   somebody's first Export.
4. **An admin could reach screens they could not use.** `PLAN/13` §3.1 requires
   MFA enrolment before any access; the app only showed a banner, so the first
   privileged action returned a 403 STEP_UP_REQUIRED that could not be satisfied
   — there was no second factor to step up with. Enrolment and the initial
   password change are now gates, not suggestions.
5. **Step-up was a dead end.** Even with MFA enrolled, a 403 STEP_UP_REQUIRED had
   no way forward: no dialog, no retry. A request that needs re-verification now
   asks for a code and replays itself.

**Found by starting the thing up**

6. **Every inspection would have failed to get a Serial Number.** Prisma binds a
   JS number as `int8`; `next_serial_number` takes `int4`, so PostgreSQL reported
   that the function did not exist. Fixed with an explicit `::int` cast at both
   call sites.
7. **Every photo upload and view would have returned 414.** The signed storage
   token is a route parameter of about 270 characters and Fastify caps those at
   100 by default. `maxParamLength` is now 1024, with a regression test pinning
   the token size.
8. **Fingerprinted assets were not cached at all.** `@fastify/static` sets its own
   `Cache-Control: public, max-age=0` — a re-download of the whole bundle on
   every visit, over exactly the 4G connections `PLAN/06` §7 budgets for.
9. **`LOG_LEVEL=silent` was rejected**, though it is a real pino level.

Five of the nine were in the paths a user actually touches, and none would have
been caught by the gates as they stand. That is the strongest argument available
for the integration suite named under G-06.

## Found while implementing

Three things the specification did not settle, recorded in
`TASKS/OPEN-QUESTIONS.md` rather than decided quietly:

1. **A 35th axle combination.** Reproducing the 34 rows in `PLAN/03` §3 needs a
   rule §4 does not state — dual steer axles only on 4- and 6-axle vehicles.
   Without it a 3-axle steer-2 configuration is also valid. Adding a `V-nn` rule
   is `PLAN/09` §6 N-02 territory, so it was not added.
2. **Recharts could not be used.** It renders through injected inline styles, and
   `PLAN/13` §7 decision A-07 fixes a CSP with no `unsafe-inline`. Loosening the
   policy for a chart would have been the wrong trade, so the dashboard chart is
   hand-written SVG — which also removed about 100 KB from the bundle budget.
3. **`user_regions` needed a surrogate key.** `PLAN/02` §6 defines it without a
   primary key, and both halves of its natural key are nullable by design, so the
   ORM could not address it. A surrogate `id` was added; the functional unique
   index that carries the real guarantee is unchanged.

## Not built

`PLAN/08` §4 is the contract and it holds: no multitenancy, no native app, no
push notifications, no custom roles, no tire lifecycle tracking, no ERP
integration, no bulk Excel import.

Beyond that list, and stated plainly:

- **F6 (migration) is a toolkit, not a migration.** `migrations/` implements the
  method in `PLAN/07` — normalisation, deduplication, quarantine — and its tests
  pin the policy. It cannot run until the inventory in `PLAN/07` §1 is done,
  which is measurement of the real spreadsheet, not something to estimate.
- **The offline queue has not been tested in a garage.** `PLAN/09` §6 N-04 says
  a human, on a real phone, with bad signal. The iOS limits in `PLAN/06` §4.3 are
  surfaced honestly in the UI rather than papered over, but surfacing them is not
  the same as having tested them.
- **WhatsApp is deliberately absent** (`PLAN/12` §4.2). It sits behind the sender
  interface so adding it later touches no domain code.
