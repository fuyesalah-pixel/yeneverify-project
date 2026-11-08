# ============================================================
# Yene Verify — Backend Dockerfile (multi-stage)
# Base: node:20-alpine
# ============================================================

# Stage 1: build + dependencies. Runtime copies node_modules from here,
# so native modules (bcrypt) must compile and prisma generate must run
# in this stage — scripts enabled, build tools installed.
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000
RUN npm ci --build-from-source
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: runtime
FROM node:20-alpine AS runtime
RUN apk add --no-cache libc6-compat openssl dumb-init
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

USER nestjs

EXPOSE 3000

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
