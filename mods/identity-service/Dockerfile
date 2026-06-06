# Slim packaging of Fonoster Identity as a standalone gRPC service.
# Built from the monorepo root (context: .) so npm workspaces resolve.
# Debian base matches the debian-openssl-3.0.x Prisma engine bundled in
# @fonoster/identity.
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the full workspace (Identity reuses hoisted dependencies).
COPY package.json package-lock.json ./
COPY mods/identity-service/package.json mods/identity-service/package.json
COPY mods/apiserver/package.json mods/apiserver/package.json
COPY mods/common/package.json mods/common/package.json
COPY mods/webapp/package.json mods/webapp/package.json
RUN npm ci --ignore-scripts

# Bring in the Identity service sources and schema.
COPY mods/identity-service mods/identity-service

WORKDIR /app/mods/identity-service

EXPOSE 50051

# Provision the Identity database, then start the gRPC service.
CMD ["sh", "-c", "npm run db:push && npm start"]
