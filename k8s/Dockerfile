# =============================================================================
# Synthex Next.js App - Kubernetes / Local Test Dockerfile
# Multi-stage build using Next.js standalone output
# =============================================================================
#
# BUILD (from project root):
#   docker build -f k8s/Dockerfile -t synthex-app:local \
#     --build-arg DATABASE_URL=postgresql://placeholder \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder \
#     .
#
# NOTE: Build-time env vars are only needed for Prisma generate + Next.js build.
#       Runtime secrets are injected via Kubernetes Secrets / ConfigMap.
# =============================================================================

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++

COPY package*.json ./
COPY prisma ./prisma/

# Use npm install (not npm ci) — package-lock.json has ajv@6/8 version conflict
# that npm ci rejects. npm install resolves it without strict lock validation.
RUN npm install --prefer-offline 2>&1 || npm install

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Build-time args for Next.js static analysis + Prisma client gen
# These are placeholder values — real secrets are injected at runtime via Kubernetes Secrets
# SUPABASE_SERVICE_ROLE_KEY is required here because 17 service files create Supabase admin
# clients at module scope; Next.js executes these imports during "Collecting page data".
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/synthex
ARG DIRECT_URL=postgresql://placeholder:placeholder@localhost:5432/synthex
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ARG SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key-build-only
ARG NEXTAUTH_SECRET=placeholder-secret-32-chars-minimum-here
ARG NEXTAUTH_URL=http://localhost:3000

ENV DATABASE_URL=${DATABASE_URL}
ENV DIRECT_URL=${DIRECT_URL}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}

# Enable standalone output for minimal container size
ENV DOCKER_BUILD=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js app (standalone output)
RUN npm run build

# Stage 3: Production runner (minimal image)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache curl

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fs http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
