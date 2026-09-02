# One image, two entrypoints: `node dist/server.js` and `node dist/worker.js`
# (PLAN/01 §5). Export jobs over tens of thousands of rows must never share an
# event loop with user requests.
#
# The image also carries the built SPA at /app/web. There is no reverse proxy in
# front of it — Cloudflare Tunnel connects straight to this process — so the api
# serves the static client itself (WEB_DIST_DIR=./web).
#
# Seeding: The image includes Prisma schema, migrations, and seed scripts for
# production deployment. CSV data is optional but included if available.

FROM node:24-alpine AS base
RUN corepack enable && apk add --no-cache openssl && npm install -g tsx
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @c26/api prisma generate \
 && pnpm --filter @c26/contracts build \
 && pnpm --filter @c26/api build \
 && pnpm --filter @c26/web build

# ── API + worker ────────────────────────────────────────────────────────────
FROM base AS api
ENV NODE_ENV=production
RUN corepack enable && apk add --no-cache openssl && npm install -g tsx
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY --from=build /app/packages/contracts/dist ./node_modules/@c26/contracts
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/src/generated/prisma ./dist/generated/prisma
COPY --from=build /app/apps/api/src ./apps/api/src

# ── Prisma files for seeding ─────────────────────────────────────────────────
# Include schema, migrations, and seed scripts for production database setup
# Must be at apps/api/prisma so pnpm db:migrate can find it
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

# Copy seed subdirectory (master-data, csv-data, demo-data, sample-photos)
COPY --from=build /app/apps/api/prisma/seed ./apps/api/prisma/seed

# Copy package.json files needed for seed scripts and pnpm db:migrate
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# The client, served by this same process (see kernel/http/static-spa.ts).
COPY --from=build /app/apps/web/dist ./web

# ── Optional: CSV seed data for production deployment ──────────────────────
# Place CSV files in requirements/ directory for tire brands and patterns
# Files: req-TB Brand Pattern.csv, req-LT Brand Pattern.csv, req-Size.csv, req-Vehicle Brand.csv
# These are optional - seeding will work without them
COPY requirements/ ./requirements/

# ── Storage directory ────────────────────────────────────────────────────────
# Photos land here when STORAGE_DRIVER=local; the compose file mounts a volume
# over it. Created with the right owner so the unprivileged user can write.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
EXPOSE 3000

# ── Entrypoint: API server ───────────────────────────────────────────────────
# For seeding, use docker exec to run scripts:
#   docker exec <container> pnpm db:migrate
#   docker exec <container> node dist/scripts/seed-prod-admin.js "password"
#   docker exec <container> node dist/scripts/seed-csv-prod.js
#   docker exec <container> tsx apps/api/prisma/seed.ts
CMD ["node", "dist/server.js"]
