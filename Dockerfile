# syntax=docker/dockerfile:1.4
# ─────────────────────────────────────────────────────────────────────────────
# QCobro — multi-stage Dockerfile
#
# Targets
#   apiserver  Node.js tRPC + REST + voice server  (port 3000)
#   webapp     Nginx serving the compiled React SPA (port 80)
#
# The apiserver depends on three fonoster packages that are file: references
# in package.json.  Run scripts/docker-build.sh instead of calling docker
# build directly — that script packs those packages into .docker-deps/ so
# this Dockerfile can resolve the file: paths inside the container.
# ─────────────────────────────────────────────────────────────────────────────
ARG NODE_VERSION=22

# ── base ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# ── deps ──────────────────────────────────────────────────────────────────────
# Place fonoster tarballs at the paths the package-lock.json expects them
# (/fonoster/mods/…), then run npm ci so local "link" entries resolve.
FROM base AS deps

COPY .docker-deps/ .docker-deps/

RUN mkdir -p /fonoster/mods/sdk /fonoster/mods/voice /fonoster/mods/identity-client && \
    tar -xzf .docker-deps/fonoster-sdk-*.tgz           -C /fonoster/mods/sdk            --strip-components=1 && \
    tar -xzf .docker-deps/fonoster-voice-*.tgz         -C /fonoster/mods/voice          --strip-components=1 && \
    tar -xzf .docker-deps/fonoster-identity-client-*.tgz -C /fonoster/mods/identity-client --strip-components=1

COPY package.json package-lock.json lerna.json ./
COPY mods/common/package.json     mods/common/
COPY mods/apiserver/package.json  mods/apiserver/
COPY mods/sdk/package.json        mods/sdk/
COPY mods/webapp/package.json     mods/webapp/

RUN npm ci --ignore-scripts

# ── build-common ──────────────────────────────────────────────────────────────
FROM deps AS build-common
COPY tsconfig.json ./
COPY mods/common mods/common
RUN npm run build --workspace=mods/common

# ── build-apiserver ───────────────────────────────────────────────────────────
FROM build-common AS build-apiserver
COPY mods/apiserver mods/apiserver
RUN npm run build --workspace=mods/apiserver

# ── build-webapp ──────────────────────────────────────────────────────────────
FROM build-common AS build-webapp
COPY mods/webapp mods/webapp
RUN npm run build --workspace=mods/webapp

# ═══════════════════════════════════════════════════════════════════════════════
# apiserver — production runtime
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:${NODE_VERSION}-alpine AS apiserver
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV QCOBRO_CONFIG=/config/qcobro.json

# Fonoster packages (extracted at build time, symlinked by npm)
COPY --from=deps /fonoster /fonoster

# Node modules (includes prisma CLI needed for migrate deploy at startup)
COPY --from=deps /app/node_modules              ./node_modules
COPY --from=deps /app/mods/apiserver/node_modules ./mods/apiserver/node_modules

# Built artifacts
COPY --from=build-apiserver /app/mods/common/dist    ./mods/common/dist
COPY --from=build-apiserver /app/mods/apiserver/dist ./mods/apiserver/dist

# Prisma schema + migrations (needed for migrate deploy)
COPY mods/apiserver/prisma ./mods/apiserver/prisma

# Entrypoint runs migrations then starts the server
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]

# ═══════════════════════════════════════════════════════════════════════════════
# webapp — nginx serving the React SPA
# ═══════════════════════════════════════════════════════════════════════════════
FROM nginx:alpine AS webapp

COPY config/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-webapp /app/mods/webapp/dist /usr/share/nginx/html

EXPOSE 80
