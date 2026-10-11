# syntax=docker/dockerfile:1
#
# The API (`apps/api`). Build from the REPO ROOT:
#
#   docker build -f apps/api/Dockerfile -t solo-starter-api .

ARG NODE_VERSION=24
ARG PNPM_VERSION=10.30.3

FROM node:${NODE_VERSION}-slim AS base
# Prisma's query engine links against OpenSSL, and `prisma generate` detects
# the binary target from it; Debian slim images don't ship it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}

# ── Builder stage ───────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy workspace manifests first (improves layer caching). The repo's .npmrc
# carries the settings the lockfile was written with; the hoisted linker is
# added for the image only, so each package resolves one physical copy.
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN echo "node-linker=hoisted" >> .npmrc
COPY packages/backend/package.json ./packages/backend/
COPY apps/api/package.json ./apps/api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy full source
COPY packages/backend/ ./packages/backend/
COPY apps/api/ ./apps/api/
# A locally generated Prisma client (macOS engines) must not leak into the image.
RUN rm -rf apps/api/generated

# Build workspace packages first (required by apps/api)
RUN pnpm --filter @app/backend build

# Build the API (generates Prisma client + compiles TypeScript)
RUN pnpm --filter @app/api build

# ── Production runner stage ─────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

# Copy workspace manifests for a production install (no dev deps)
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN echo "node-linker=hoisted" >> .npmrc
COPY packages/backend/package.json ./packages/backend/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --prod

# Copy compiled artefacts from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Copy the Prisma schema, migrations and CLI configuration so migrations can
# run at deploy time
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
# Retries `migrate deploy` while a sleeping Postgres wakes (pre-deploy step).
COPY --from=builder /app/apps/api/scripts/migrate-deploy.mjs ./apps/api/scripts/

# Copy the generated Prisma client: dist/index.js requires ../generated/prisma
# and the prod install never runs prisma generate.
COPY --from=builder /app/apps/api/generated ./apps/api/generated

ENV NODE_ENV=production
# The port the API listens on unless the host sets PORT.
ENV PORT=4000
EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
