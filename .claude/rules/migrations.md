---
description: Database migration rules
paths: ["apps/api/prisma/**"]
---

# Migration Rules (PLAN/09 §4.4)

- **NEVER** run `prisma migrate dev`; it drops and recreates the database.
  Use `pnpm db:migrate` (`prisma migrate deploy`).
- Migrations are hand-written SQL in
  `prisma/migrations/<n>_<name>/migration.sql`. `schema.prisma` follows, for
  client types only — many constructs in `PLAN/02` (generated columns,
  constraint triggers, partitions, materialized views, `citext`) cannot be
  expressed in Prisma at all.
- **Migrations are non-destructive.** Columns are not dropped, only marked
  obsolete and no longer read. Tables are never `DROP`ped.
- Every migration runs against an empty database **and** a staging copy before
  it touches production (gate G-09).
- Every `CHECK`, partial unique index, and trigger in `PLAN/02` / `PLAN/11`
  must exist in the migration. Constraints are the enforcement; application
  code only translates violations into Indonesian messages (`PLAN/05` §4.6).
- Every new constraint needs a row in the error translation map at
  `apps/api/src/kernel/envelope/database-errors.ts`. Without it, a violation
  leaks out as a `500`.
