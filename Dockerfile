# syntax=docker/dockerfile:1.7
# One Dockerfile, four targets:
#   web      Next.js standalone server           docker build --target web -t quizbo-web .
#   battle   Socket.io battle service            docker build --target battle -t quizbo-battle .
#   worker   BullMQ jobs (question bank, replan) docker build --target worker -t quizbo-worker .
#   migrate  prisma migrate deploy + seed        docker build --target migrate -t quizbo-migrate .

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*

# ── dependencies (cached on manifests + Prisma schema) ─────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/battle/package.json apps/battle/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/ai/package.json packages/ai/
COPY packages/db/package.json packages/db/prisma.config.ts packages/db/
COPY packages/db/prisma packages/db/prisma
RUN npm ci

# ── source ─────────────────────────────────────────────────────────────────────
FROM deps AS source
COPY . .
RUN npm run generate -w @quizbo/db

# ── web build ──────────────────────────────────────────────────────────────────
FROM source AS web-build
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
ARG NEXT_PUBLIC_BATTLE_URL=http://localhost:4000
ARG NEXT_PUBLIC_FISTS_VIDEO_URL=
ARG NEXT_PUBLIC_FISTS_POSTER_URL=
ENV NEXT_PUBLIC_BATTLE_URL=$NEXT_PUBLIC_BATTLE_URL \
    NEXT_PUBLIC_FISTS_VIDEO_URL=$NEXT_PUBLIC_FISTS_VIDEO_URL \
    NEXT_PUBLIC_FISTS_POSTER_URL=$NEXT_PUBLIC_FISTS_POSTER_URL \
    NEXT_OUTPUT=standalone
RUN npm run build -w @quizbo/web

FROM base AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ── runtime dependencies (drops build-only packages, e.g. the local PostgreSQL used in dev) ───
FROM source AS runtime
RUN npm prune --omit=dev

# ── battle service (one instance, or several with BATTLE_REDIS_URL) ───────────
FROM runtime AS battle
ENV NODE_ENV=production PORT=4000
USER node
EXPOSE 4000
CMD ["node", "--import", "tsx", "apps/battle/src/index.ts"]

# ── worker ─────────────────────────────────────────────────────────────────────
FROM runtime AS worker
ENV NODE_ENV=production
USER node
CMD ["node", "--import", "tsx", "apps/worker/src/index.ts"]

# ── migrations + seed (run once per deploy) ────────────────────────────────────
FROM runtime AS migrate
ENV NODE_ENV=production
CMD ["sh", "-c", "npm run migrate:deploy -w @quizbo/db && npm run seed -w @quizbo/db"]
