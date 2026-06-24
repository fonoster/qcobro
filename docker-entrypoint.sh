#!/bin/sh
set -e

echo "→ Running database migrations..."
node /app/mods/apiserver/scripts/prisma.mjs migrate deploy

echo "→ Starting API server..."
exec node /app/mods/apiserver/dist/index.js
