#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/docker-build.sh
#
# Builds the qcobro-apiserver and qcobro-webapp Docker images. The @fonoster/*
# packages are ordinary published npm dependencies, so this is a plain build —
# no sibling checkout or dependency packing required.
#
# Usage:
#   ./scripts/docker-build.sh [--tag <tag>]
#
# Options:
#   --tag          Image tag suffix, e.g. "v1.2.0" (default: "latest")
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

TAG="latest"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

echo "── Building Docker images (tag: $TAG) ──"

docker build --target apiserver -t "qcobro-apiserver:$TAG" .
docker build --target webapp    -t "qcobro-webapp:$TAG"    .

echo ""
echo "Done."
echo "  qcobro-apiserver:$TAG"
echo "  qcobro-webapp:$TAG"
