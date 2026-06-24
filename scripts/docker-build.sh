#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/docker-build.sh
#
# Packs the three fonoster file: dependencies into .docker-deps/ tarballs,
# then builds the qcobro-apiserver and qcobro-webapp Docker images.
#
# Usage:
#   ./scripts/docker-build.sh [--tag <tag>]
#
# Options:
#   FONOSTER_DIR   Path to the fonoster repository (default: ../fonoster)
#   --tag          Image tag suffix, e.g. "v1.2.0" (default: "latest")
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

FONOSTER_DIR="${FONOSTER_DIR:-../fonoster}"
TAG="latest"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ ! -d "$FONOSTER_DIR" ]]; then
  echo "ERROR: fonoster repo not found at $FONOSTER_DIR"
  echo "Set FONOSTER_DIR to the correct path, e.g.:"
  echo "  FONOSTER_DIR=/opt/fonoster ./scripts/docker-build.sh"
  exit 1
fi

echo "── Packing fonoster dependencies from $FONOSTER_DIR ──"
rm -rf .docker-deps && mkdir -p .docker-deps

for pkg in sdk voice identity-client; do
  pkgdir="$FONOSTER_DIR/mods/$pkg"

  # Build the package if dist/ is missing or stale
  if [[ ! -d "$pkgdir/dist" ]]; then
    echo "  Building @fonoster/$pkg..."
    (cd "$pkgdir" && npm install --ignore-scripts && npm run build)
  fi

  echo "  Packing @fonoster/$pkg..."
  (cd "$pkgdir" && npm pack --pack-destination "$(pwd)/../../../qcobro/.docker-deps/" --quiet)
done

echo "── Building Docker images (tag: $TAG) ──"

docker build --target apiserver -t "qcobro-apiserver:$TAG" .
docker build --target webapp    -t "qcobro-webapp:$TAG"    .

echo ""
echo "Done."
echo "  qcobro-apiserver:$TAG"
echo "  qcobro-webapp:$TAG"
