# The QCobro dev container's workspace: Node 22, and the Chromium the e2e tests drive, installed
# here so `npm run test:e2e` needs no download. initialize.sh builds it from the repository root.

# The Playwright version the lockfile pins, alone in a file: the browser layer below is rebuilt
# only when that version changes, not on every lockfile change.
FROM node:22-bookworm-slim AS playwright-version
COPY package-lock.json /tmp/
RUN node -p 'require("/tmp/package-lock.json").packages["node_modules/playwright-core"].version' \
  > /playwright-version

FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm
# openssl for Prisma and for scripts/dev-config.mjs (the fake's certificate).
RUN apt-get update \
  && export DEBIAN_FRONTEND=noninteractive \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
# Chromium and its OS dependencies, where the workspace's Playwright looks for them.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=playwright-version /playwright-version /tmp/
RUN npx -y "playwright@$(cat /tmp/playwright-version)" install --with-deps chromium \
  && chmod -R a+rX /ms-playwright \
  && rm -rf /root/.npm /tmp/playwright-version /var/lib/apt/lists/*
