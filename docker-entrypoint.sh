#!/bin/sh
set -e

echo "→ Running database migrations..."
cd /app/mods/apiserver && node scripts/prisma.mjs migrate deploy && cd /app

echo "→ Starting API server..."
exec node /app/mods/apiserver/dist/index.js
