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
cp .env.example .env          # fill in the values; never commit this file
docker compose up -d          # postgres:18-alpine
pnpm install
pnpm --filter @c26/api prisma generate
pnpm db:migrate               # NOT `prisma migrate dev` — see PLAN/09 §4.5
pnpm db:seed                  # master data, first admin, demo data + sample photos
pnpm dev                      # api on :3000, web on :5173
```

`pnpm db:seed` creates the `uploads/` directory, five demo accounts (one per
role, plus a second supplier), and six inspections covering every state in the
status machine — including a vehicle that carries both a dropped inspection and
a fresh draft, which is the locking rule in `PLAN/11` §5.4 made visible. Sample
photographs are generated for every tire position, labelled with the position
they belong to, so a slot/photo mismatch is obvious at a glance.

Demo accounts share `SEED_DEMO_PASSWORD` and sign in through the normal login;
leaving that variable empty seeds master data and the first admin only.

## Where photos are stored

`STORAGE_DRIVER=local` writes them to `./uploads` and serves them through the
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
