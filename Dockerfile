# syntax=docker/dockerfile:1
#
# Self-hosted build of the Restocare website (see docs/self-hosting.md).
# Vercel does not use this file; it builds the project itself.

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
# --ignore-scripts skips the `prepare` git-hooks script (no .git here, and scripts/ is not copied yet).
RUN npm ci --ignore-scripts

# ---- build ----
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1

# app/.well-known/assetlinks.json is force-static, so these are read at BUILD
# time, not at runtime. Public values (package name, certificate fingerprints).
ARG ANDROID_PACKAGE_NAME=com.restocare.customer
ARG ANDROID_CERT_SHA256=
ENV ANDROID_PACKAGE_NAME=$ANDROID_PACKAGE_NAME \
    ANDROID_CERT_SHA256=$ANDROID_CERT_SHA256

COPY --from=deps /app/node_modules ./node_modules
# NEXT_PUBLIC_* values come from the committed .env.production (kept by .dockerignore).
COPY . .
RUN npm run build

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
