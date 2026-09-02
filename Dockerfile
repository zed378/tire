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
COPY --from=build /app/apps/api/src/scripts ./apps/api/src/scripts

# Create symlink so commands running inside apps/api (like pnpm db:migrate) resolve dist/ correctly
RUN mkdir -p ./apps/api && ln -s /app/dist ./apps/api/dist

# ── Prisma schema and migrations ─────────────────────────────────────────────
# `prisma migrate deploy` reads these, and it runs with apps/api as its working
# directory, so they have to land at apps/api/prisma.
#
# The seed itself is NOT here: it compiles to dist/scripts/ with the rest of the
# application and runs as plain node. An earlier arrangement executed the seed
# from .ts source with a globally installed tsx, which broke twice — once
# because the source file was never copied into the image, and once because the
# copy landed at a path the runner did not look in.
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

# Copy package.json files needed for seed scripts and pnpm db:migrate
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# The client, served by this same process (see kernel/http/static-spa.ts).
COPY --from=build /app/apps/web/dist ./web

# ── CSV master data ──────────────────────────────────────────────────────────
# Tire and vehicle brands, and the tire patterns under each brand. Baked in so
# the image can seed itself; docker-compose.prod.yml also bind-mounts the host's
# copy read-only over the top, so updated files do not need a rebuild.
#
# Optional: seed-init reports their absence clearly and seeds the built-in
# master data anyway rather than failing the deployment.
COPY requirements/ ./requirements/

# ── Storage directory ────────────────────────────────────────────────────────
# Photos land here when STORAGE_DRIVER=local; the compose file mounts a volume
# over it. Created with the right owner so the unprivileged user can write.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
EXPOSE 3000

# ── Deployment-time database work ───────────────────────────────────────────
# None of it happens here. The `db-init` service in docker-compose.prod.yml runs
# it as its `command`, and api and worker wait for that to succeed:
#
#   pnpm db:migrate    prisma migrate deploy, then pg-boss queue setup
#   pnpm db:seed:init  reference data — provinces, cities, brands, patterns
#
# Both are compiled JavaScript under dist/, run by node. An earlier arrangement
# put this in a docker-entrypoint.sh that was never copied into the image and
# never set as an ENTRYPOINT, so it never ran and nothing said so.
#
# The first admin account is created by an operator, never by a deployment:
#   docker exec <container> node dist/scripts/seed-prod-admin.js "password"
# so no password is ever part of a deployment step (PLAN/13 §8).

# ── Entrypoint: API server ───────────────────────────────────────────────────
CMD ["node", "dist/server.js"]
