# syntax=docker/dockerfile:1.4
# ─────────────────────────────────────────────────────────────────────────────
# QCobro — multi-stage Dockerfile
#
# Targets
#   apiserver  Node.js tRPC + REST + voice server  (port 3000)
#   webapp     Nginx serving the compiled React SPA (port 80)
#
# The @fonoster/* packages are ordinary published npm dependencies, so a plain
# `npm ci` resolves everything — no sibling checkout or tarball packing needed.
# ─────────────────────────────────────────────────────────────────────────────
ARG NODE_VERSION=22

# ── base ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# ── deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps

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
# Based on build-apiserver (not build-common): the webapp's type-check imports
# the tRPC AppRouter type from apiserver's source, which transitively references
# the generated Prisma client — both of which exist in the build-apiserver stage.
FROM build-apiserver AS build-webapp
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

# Node modules, copied from build-apiserver so they include the generated
# Prisma client (the entrypoint runs migrate deploy but not generate) plus the
# prisma CLI. npm hoists all workspace deps to the root node_modules, so there
# is no per-workspace node_modules to copy.
COPY --from=build-apiserver /app/node_modules ./node_modules

# Built artifacts
COPY --from=build-apiserver /app/mods/common/dist    ./mods/common/dist
COPY --from=build-apiserver /app/mods/apiserver/dist ./mods/apiserver/dist

# Prisma schema + migrations (needed for migrate deploy)
COPY mods/apiserver/prisma ./mods/apiserver/prisma

# Migration wrapper — reads DB URL from qcobro.json so the entrypoint
# doesn't need DATABASE_URL in the environment separately.
COPY mods/apiserver/scripts/prisma.mjs ./mods/apiserver/scripts/prisma.mjs

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
