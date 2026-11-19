#!/usr/bin/env bash
# Runs once when the dev container is created (postCreateCommand). Safe to re-run.
set -euo pipefail

# Named volumes are created root-owned.
sudo chown node:node node_modules mods/apiserver/node_modules mods/ctl/node_modules \
  mods/fonoster-fake/node_modules
# The checkout is owned by your host user, not `node`: let git (and the Husky hooks) use it.
git config --global --add safe.directory '*'

npm ci --no-audit --no-fund
npm run build --workspace=mods/common
# Before the SDK: its build type-checks the apiserver's router, which needs the Prisma client.
npm run db:generate
npm run build --workspace=mods/sdk
npm run db:migrate:deploy

# The seed creates the demo user through Identity, which migrates its database on first start.
for _ in $(seq 1 60); do
  (echo > /dev/tcp/identity/50051) 2>/dev/null && break
  sleep 2
done
npm run db:seed --workspace=mods/apiserver

cat <<'MSG'

QCobro dev container ready. Start the API and the console with:

  npm run start:dev       # API :3000
  npm run start:webapp    # console :5173

Log in as demo@qcobro.com / password123.
MSG
