#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/deploy/refresh-envoy-certs.sh
#
# Copies the live Let's Encrypt cert + key into the Envoy cert dir
# (<repo>/config/certs) and restarts Envoy so it picks them up.
#
# Why the copy exists: this droplet runs Docker with userns-remap, so the
# Envoy container's root maps to an unprivileged host UID that cannot read
# certbot's 0600 key or traverse its 0700 live/archive dirs. Envoy therefore
# reads from config/certs (world-readable 0644 copies) instead of mounting
# /etc/letsencrypt directly.
#
# Runs in two situations, both as root:
#   1. As a certbot --deploy-hook (set by tls.sh at issuance and persisted into
#      the renewal config), so the systemd renew timer refreshes Envoy
#      automatically. certbot provides $RENEWED_LINEAGE.
#   2. Manually / from tls.sh, with the live dir passed as the first argument.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Repo root is two levels up from this script — derived, not hardcoded, so the
# persisted deploy-hook keeps working regardless of where the repo lives.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="${COMPOSE_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
CERT_DIR="$COMPOSE_DIR/config/certs"

# certbot sets RENEWED_LINEAGE when run as a deploy-hook (e.g.
# /etc/letsencrypt/live/app.qcobro.com); for manual runs, accept it as $1.
LINEAGE="${RENEWED_LINEAGE:-${1:-}}"
if [ -z "$LINEAGE" ] || [ ! -d "$LINEAGE" ]; then
  echo "refresh-envoy-certs: no valid lineage dir (set RENEWED_LINEAGE or pass the live dir as arg)" >&2
  exit 1
fi

mkdir -p "$CERT_DIR"
# -L dereferences the live/ symlinks so we copy real file contents.
cp -L "$LINEAGE/fullchain.pem" "$CERT_DIR/fullchain.pem"
cp -L "$LINEAGE/privkey.pem"   "$CERT_DIR/privkey.pem"
chmod 644 "$CERT_DIR"/fullchain.pem "$CERT_DIR"/privkey.pem

cd "$COMPOSE_DIR"
docker compose restart envoy
echo "refresh-envoy-certs: refreshed certs and restarted Envoy for $(basename "$LINEAGE")"
