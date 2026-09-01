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
| G-09 migrations apply to an empty database | **not run** | needs a running PostgreSQL |
| G-10 no demo panel, no hardcoded credentials | pass | zero hits |
| G-11 end-to-end QC flow | **not run** | needs a database and a seeded environment |
| G-12 client bundle <= 180 KB gzipped | pass | 148.8 KB |
| G-13 lockfile does not drift | pass | frozen install |

356 tests pass: 197 contracts, 129 API, 19 migration, 11 web.

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
cp .env.example .env          # fill in the values
docker compose up -d          # postgres:18-alpine
pnpm install
pnpm --filter @c26/api prisma generate
pnpm db:migrate               # exercises G-09
pnpm db:seed                  # demo accounts + sample photographs
pnpm dev
```

Then G-09, G-11, and the seed path can all be observed. Until a database has
run, those three gates are untested claims rather than facts, and this document
says so.

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
