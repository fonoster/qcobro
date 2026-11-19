#!/usr/bin/env bash
# Runs the e2e suite inside the dev container: CI's e2e job (devcontainers/ci runCmd), and locally
# `npx @devcontainers/cli exec --workspace-folder . bash .devcontainer/ci-e2e.sh`.
# post-create.sh has already installed, migrated and seeded, and the workspace image already has
# Chromium. Starts the API and the console, waits for both, then runs Playwright and exits with
# its code.
set -uo pipefail

LOGS="${TMPDIR:-/tmp}/qcobro-e2e"
mkdir -p "$LOGS"

npm run start:dev > "$LOGS/apiserver.log" 2>&1 &
npm run start:webapp > "$LOGS/webapp.log" 2>&1 &

ready=
for _ in $(seq 1 60); do
  if curl -sf localhost:3000/health > /dev/null && curl -sf localhost:5173 > /dev/null; then
    ready=1
    break
  fi
  sleep 2
done

if [ -z "$ready" ]; then
  echo "The API (:3000) or the console (:5173) did not start within 120 s." >&2
  tail -n 100 "$LOGS/apiserver.log" "$LOGS/webapp.log" >&2
  exit 1
fi

npm run test:e2e
