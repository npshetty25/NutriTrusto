# syntax=docker/dockerfile:1

# Three stages so the runtime image carries only the traced server bundle:
# no devDependencies, no source, no build cache.

# ── 1. dependencies ─────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── 2. build ────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so
# they are build arguments. They are public by design (the anon key is
# protected by row-level security), never secrets. GEMINI_API_KEY is NOT here:
# it is a runtime variable and must never be baked into an image layer.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
# next.config.ts names the service-worker cache after this; without .git in
# the build context it would otherwise fall back to a timestamp.
ARG GIT_SHA=docker

ENV NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1 \
    VERCEL_GIT_COMMIT_SHA=${GIT_SHA} \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── 3. runtime ──────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

USER app
EXPOSE 3000

# Liveness only: a database blip must not make the orchestrator restart a
# container that is serving fine. Readiness is GET /api/health.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health?probe=live" > /dev/null || exit 1

CMD ["node", "server.js"]
