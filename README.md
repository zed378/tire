# Commercial 2026

Bus and truck tire data system. A ground-up rewrite of a Google Apps Script +
Sheets application whose limits are documented in `PLAN/00` §2.1.

The specification is `PLAN/` and it is binding. Where code and a document
disagree, the document is right.

## Layout

```
PLAN/                  the binding specification (14 documents)
packages/contracts/    Zod schemas + types, imported by BOTH api and web
apps/api/              Fastify + Prisma + PostgreSQL 18; also hosts the worker
uploads/               photo storage while STORAGE_DRIVER=local (git-ignored)
  src/kernel/axle/     the axle configuration engine — pure logic, zero imports
apps/web/              Vite + React 19 SPA, installable as a PWA
migrations/            the F6 legacy migration toolkit (PLAN/07)
scripts/               CI gate scripts G-03, G-04, G-08, G-10
TASKS/                 one file per agent task (PLAN/09 §3.2 template)
ACCEPTANCE/            per-phase acceptance lists, signed by a human
```

## Getting started

```bash
cp .env.example .env          # works as-is for local; never commit this file
docker compose up -d          # postgres:18-alpine
pnpm install
pnpm --filter @c26/api prisma generate
pnpm db:migrate               # schema + the job queue. NOT `prisma migrate dev`
pnpm db:seed                  # master data, first admin, demo data + sample photos
pnpm dev                      # api on :3000, web on :5173
pnpm dev:worker               # separate terminal: processes background jobs
```

`pnpm db:migrate` runs two steps: the Prisma migration, then `node dist/scripts/queue-setup.js`, which
installs the pg-boss schema **and a partition per queue**. Both are needed before
the API can enqueue anything, because `PLAN/12` §2.1 has it write the job inside
the caller's transaction. The API refuses to start if that schema is missing
rather than failing later, on somebody's first Export.

The worker is a separate process on purpose (`PLAN/01` §5): exports over tens of
thousands of rows must never share an event loop with a field worker's upload.
Without it running, jobs queue up and are processed once it starts — exports stay
at "Menyiapkan berkas…", and the queue depth is visible on the operations panel.

`pnpm db:seed` creates the `uploads/` directory, five demo accounts (one per
role, plus a second supplier), and six inspections covering every state in the
status machine — including a vehicle that carries both a dropped inspection and
a fresh draft, which is the locking rule in `PLAN/11` §5.4 made visible. Sample
photographs are generated for every tire position, labelled with the position
they belong to, so a slot/photo mismatch is obvious at a glance.

Demo accounts share `SEED_DEMO_PASSWORD` and sign in through the normal login;
leaving that variable empty seeds master data and the first admin only.

## How it is exposed

Cloudflare Tunnel runs on the VM and connects straight to the api container.
There is no reverse proxy: the api process serves the built SPA, sets the
security headers, compresses, and enforces the host split itself.

| Hostname | Serves |
|---|---|
| `tire.zedth.my.id` | The SPA and the whole API, on one origin |
| `tire-store.zedth.my.id` | `/api/uploads/{signed-token}` and nothing else. Every other path answers 404 |

Point both hostnames at `http://127.0.0.1:3000`. The api tells them apart by
Host header, in [`kernel/http/hosts.ts`](apps/api/src/kernel/http/hosts.ts) —
code rather than proxy configuration, because it is a security boundary and a
boundary that can be unit-tested is worth more than one in a config file.

Serving the API on the application's own origin removes the three costs
`PLAN/01` §4.2 accepted for splitting the SPA from the API: no CORS, no
cross-site cookie handling, one entry point. What the split was for — a
client/server boundary that cannot leak, and a backend not tied to React — is a
property of the code and is unchanged.

The storage host is separate for one reason. It serves customer fleet
photographs, authorised solely by a signed, expiring, single-purpose token
(`PLAN/05` §7). The session cookie is **host-only** on `tire.zedth.my.id`, so it
is never sent to `tire-store.zedth.my.id` — a leaked photo URL carries no session
with it. Leave `COOKIE_DOMAIN` empty in production; setting it to `zedth.my.id`
would widen the cookie to every subdomain and give that property away.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The api publishes only to `127.0.0.1:3000`, so nothing is reachable from the
VM's network — the tunnel is the sole way in. The production compose topology includes:
- `api`: API server and SPA static file host (`127.0.0.1:3000`)
- `worker`: Background job worker
- `db-init`: Runs once per deployment, before `api` and `worker` are allowed to
  start: migrations, pg-boss queue setup, then reference-data seeding
  (`pnpm db:migrate && pnpm db:seed:init`)
- `postgres`: PostgreSQL 18 database engine
- `pgadmin`: Database GUI manager (`127.0.0.1:5050`, dev local on `:5050`)

### Database seeding in production

Reference data seeds itself. The `db-init` container runs
`pnpm db:seed:init` after the migrations, on every deployment, and `api` and
`worker` wait for it to succeed — so a failed seed holds the deployment instead
of bringing the system up with empty dropdowns.

It seeds provinces, cities, vehicle brands, tire brands and tire brand patterns,
reading the CSVs bind-mounted at `/app/requirements`. It is idempotent: it adds
only what is missing and never modifies a row an admin has since edited. Re-run
it by hand with:

```bash
docker exec -it commercial2026-api-1 pnpm db:seed:init
```

If the CSVs live somewhere else, point `SEED_REQUIREMENTS_DIR` at them.

**The first admin account is the one thing that is not automatic**, because a
deployment step is not a place for a password (PLAN/13 §8). Create it once, by
hand, after the stack is up:

```bash
docker exec -it commercial2026-api-1 node dist/scripts/seed-prod-admin.js "PasswordProdSecret123!"

# Or via pnpm shortcut:
docker exec -it commercial2026-api-1 pnpm db:seed:prod-admin "PasswordProdSecret123!"

# Optional: specify a custom admin username (default: admin)
docker exec -it commercial2026-api-1 node dist/scripts/seed-prod-admin.js "PasswordProdSecret123!" --username=superadmin
```

`pnpm db:seed` is the local-development seed. It refuses to run when
`APP_ENV=production`, because it also creates accounts and demo inspections.

### If a deployment stops with `P3009`

`prisma migrate deploy` refuses to apply anything while a previously failed
migration is recorded, and it stays recorded until an operator says what
happened to it. Check what failed and whether it changed anything:

```bash
docker exec -it commercial2026-postgres-1 psql -U c26 -d c26   -c "select migration_name, started_at, finished_at, applied_steps_count, logs
      from _prisma_migrations where finished_at is null;"
```

`applied_steps_count = 0` means the database was not touched, so the entry can
be marked rolled back and the deployment retried:

```bash
docker compose -f docker-compose.prod.yml run --rm --entrypoint sh db-init   -c "cd /app/apps/api && node /app/node_modules/prisma/build/index.js       migrate resolve --rolled-back <migration_name>"
```

If any steps *were* applied, do not do this — work out what landed first. This
is deliberately a manual step: a deploy script that clears its own failed
migrations will eventually clear one that mattered.

## Where photos are stored

`STORAGE_DRIVER=local` writes them to `apps/api/uploads` and serves them through the
API using short-lived signed tokens. The device-side protocol is exactly the one
in `PLAN/05` §7 — presign, PUT to the returned URL, confirm — so switching to
Cloudflare R2 later is one environment variable and no client change.

Two things the local driver gives up, stated so the decision stays visible:

| Given up | Why it matters eventually |
|---|---|
| Uploads bypassing the app server | `PLAN/05` §7 routes them around it on purpose; at 18,000 uploads a month the bytes cost bandwidth and memory here |
| Versioned, lifecycle-managed storage | `PLAN/01` §5.2 assumes 90 days of recovery on deleted objects. On a disk, the `uploads` volume is the only copy of the evidence, so it must be in the backup job |

**Switch to `s3` when any of these is true:** photo storage passes ~50 GB, the
retention policy in `PLAN/06` §6 starts being enforced for real, or a second
API instance is added — two processes cannot share a local directory.

## The one command that matters

```bash
pnpm verify
```

typecheck + lint (including module boundaries) + tests with coverage
thresholds + the forbidden-pattern gate + the rule/test sync gate. It must be
green before any task is done, and no lint rule may be disabled to get there.

## What the architecture is protecting

| Guard | Against |
|---|---|
| `kernel/axle` has zero imports, 100% branch coverage, mutation score >= 85% | A silent regression in the one piece of domain logic that decides all downstream data (`K-01`, `K-02`) |
| Gate G-04 counts `V-nn` rules in `PLAN/03` against tests naming them | `D-04`: a validation rule that was never written never fails and is never seen |
| Gate G-03 greps for `alert(`/`confirm(`/`prompt(` | `D-08`: failures that nobody — user, developer, or tooling — can see |
| One `transitionInspection()` function, enforced by lint | Status columns written freely, with no history and no audit trail |
| Database `CHECK`s, triggers, and partial unique indexes | `D-04`, `D-05`, `D-06`: defects that got through because validation lived only in the form |
| Transactional outbox | Notifications for events that never happened, and events nobody was told about |

## Not built, deliberately

Multitenancy, a native app, push notifications, custom roles, tire lifecycle
tracking, ERP integration, bulk Excel import. `PLAN/08` §4 is the contract; a
new request joins the list rather than the current phase.
