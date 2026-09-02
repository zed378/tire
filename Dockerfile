# One image, two entrypoints: `node dist/server.js` and `node dist/worker.js`
# (PLAN/01 §5). Export jobs over tens of thousands of rows must never share an
# event loop with user requests.
#
# The image also carries the built SPA at /app/web. There is no reverse proxy in
# front of it — Cloudflare Tunnel connects straight to this process — so the api
# serves the static client itself (WEB_DIST_DIR=./web).

FROM node:24-alpine AS base
RUN corepack enable && apk add --no-cache openssl
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
RUN corepack enable && apk add --no-cache openssl
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY --from=build /app/packages/contracts/dist ./node_modules/@c26/contracts
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/src/generated/prisma ./dist/generated/prisma
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/prisma.config.ts ./prisma.config.ts
# The client, served by this same process (see kernel/http/static-spa.ts).
COPY --from=build /app/apps/web/dist ./web
# CSV seed data for production deployment
COPY requirements/ ./requirements/
# Photos land here when STORAGE_DRIVER=local; the compose file mounts a volume
# over it. Created with the right owner so the unprivileged user can write.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
