#!/bin/sh
# Runs on the host before the dev container's services start (initializeCommand), each time the
# editor or `npx @devcontainers/cli up` opens it. Needs only a POSIX shell, git and Docker.
#
# It writes only what is missing under .dev/ (git-ignored), so running it again changes nothing:
#   .dev/.env   what Compose interpolates: this checkout's absolute path and its git common
#               directory (mounted at the same paths inside, so a worktree's .git file resolves),
#               the Compose project (one stack per checkout), your git identity for commits made
#               inside, and the fake Fonoster's generated secrets
# then builds the workspace image and runs scripts/dev-config.mjs in it, which writes the rest
# (Identity's keys and config, the fake's TLS files, qcobro.json). To start over, delete .dev/
# and open the container again.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
DEV="$ROOT/.dev"
IMAGE=qcobro-dev-workspace

log() { printf '[dev-config] %s\n' "$*" >&2; }
die() { printf '[dev-config] %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "Docker is required"

# 32 random bytes, hex, without openssl on the host.
secret() { od -An -tx1 -N32 /dev/urandom | tr -d ' \n'; }

if [ ! -f "$DEV/.env" ]; then
  mkdir -p "$DEV"
  checkout="$ROOT"
  common_dir="$(cd "$ROOT" && cd "$(git rev-parse --git-common-dir)" && pwd -P)"
  # A Compose project name allows only lowercase letters, digits, '-' and '_'.
  project="qcobro-$(basename "$checkout" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9_\n-' '-')"
  {
    echo "QCOBRO_CHECKOUT=$checkout"
    echo "QCOBRO_GIT_COMMON_DIR=$common_dir"
    echo "COMPOSE_PROJECT_NAME=$project"
    echo "GIT_AUTHOR_NAME=$(git config user.name || true)"
    echo "GIT_AUTHOR_EMAIL=$(git config user.email || true)"
    echo "FONOSTER_FAKE_API_SECRET=$(secret)"
    echo "FONOSTER_FAKE_WEBHOOK_SECRET=$(secret)"
  } > "$DEV/.env"
  chmod 600 "$DEV/.env"
  log "wrote $DEV/.env"
fi

# Compose reads .env next to compose.yaml.
ln -sfn ../.dev/.env "$ROOT/.devcontainer/.env"

# Built here rather than by Compose: Compose 5 builds through Bake, which refuses the Dockerfile
# the dev container client writes outside the build context. Cached after the first build.
log "building the workspace image ($IMAGE)"
docker build -q -t "$IMAGE" -f "$ROOT/.devcontainer/Dockerfile" "$ROOT" >/dev/null \
  || die "could not build .devcontainer/Dockerfile"

# The generator needs Node and openssl: the workspace image has both, so the host needs neither.
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$ROOT:$ROOT" -w "$ROOT" "$IMAGE" \
  node scripts/dev-config.mjs || die "scripts/dev-config.mjs failed"
