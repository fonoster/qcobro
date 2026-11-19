# syntax=docker/dockerfile:1.4
# ─────────────────────────────────────────────────────────────────────────────
# @qcobro/fonoster-fake — a fake of the Fonoster surface QCobro uses.
# Development and tests only: never built by docker-publish.yml, never deployed.
#
#   docker build -f mods/fonoster-fake/Dockerfile -t qcobro/fonoster-fake .
#
# Build from the repository root (it needs the root package-lock.json).
# ─────────────────────────────────────────────────────────────────────────────
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY mods/common/package.json mods/common/
COPY mods/fonoster-fake/package.json mods/fonoster-fake/
RUN npm ci --ignore-scripts --workspace=mods/fonoster-fake
COPY mods/fonoster-fake mods/fonoster-fake
RUN npm run build --workspace=mods/fonoster-fake

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY mods/common/package.json mods/common/
COPY mods/fonoster-fake/package.json mods/fonoster-fake/
RUN npm ci --ignore-scripts --omit=dev --workspace=mods/fonoster-fake

FROM node:${NODE_VERSION}-alpine
# The SDK reaches the records API at https://<endpoint host> with no port, so the fake serves
# HTTPS on 443. Let node bind it without running as root.
RUN apk add --no-cache libcap && setcap cap_net_bind_service=+ep "$(readlink -f "$(which node)")"
WORKDIR /app
ENV NODE_ENV=production \
    FONOSTER_FAKE_GRPC_PORT=50052 \
    FONOSTER_FAKE_HTTPS_PORT=443 \
    FONOSTER_FAKE_CONTROL_PORT=8080
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/mods/fonoster-fake/node_modules ./mods/fonoster-fake/node_modules
COPY mods/fonoster-fake/package.json mods/fonoster-fake/
COPY --from=build /app/mods/fonoster-fake/dist mods/fonoster-fake/dist
USER node
EXPOSE 50052 443 8080
CMD ["node", "mods/fonoster-fake/dist/main.js"]
