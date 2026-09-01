# One image, two entrypoints: `node dist/server.js` and `node dist/worker.js`
# (PLAN/01 §5). Export jobs over tens of thousands of rows must never share an
# event loop with user requests.

FROM node:22-alpine AS base
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
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]

# ── Static client, copied out by Caddy ──────────────────────────────────────
FROM scratch AS web
COPY --from=build /app/apps/web/dist /web
