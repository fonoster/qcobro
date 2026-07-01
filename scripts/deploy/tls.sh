#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/deploy/tls.sh
#
# Idempotent TLS cert management for the QCobro stack. Safe to run on every
# deploy and to fire by hand.
#
#   - First run (no cert yet): issues the certificate via certbot --standalone
#     and wires the renewal deploy-hook (refresh-envoy-certs.sh).
#   - Later runs: checks days-to-expiry and ONLY calls certbot when the cert is
#     inside the renewal window (default 30 days). This keeps us well clear of
#     Let's Encrypt rate limits — far from expiry it's a fast no-op that never
#     touches certbot or restarts Envoy.
#   - If TLS_API_DOMAIN is set and the existing cert does not yet cover it, an
#     --expand issuance is run once to add the SAN (e.g. api.qcobro.com). After
#     that, normal renewals preserve the full SAN list automatically.
#
# Envoy is only restarted when the cert actually changes, because the copy +
# restart live in the certbot deploy-hook, which fires solely on real renewals.
#
# Usage:
#   scripts/deploy/tls.sh [--domain <d>] [--api-domain <d>] [--email <e>] [--days <n>] [--force]
#
# Config resolution (first wins): CLI flag → environment → .env in repo root.
#   TLS_DOMAIN      primary domain to certify  (e.g. app.qcobro.com)
#   TLS_API_DOMAIN  optional extra SAN          (e.g. api.qcobro.com)
#   TLS_EMAIL       ACME account / notices      (e.g. ops@qcobro.com)
#   TLS_DAYS        renewal window in days      (default 30)
#
# Requires: root (or passwordless sudo), certbot, docker compose. Linux/GNU date.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_DIR"

# Pull defaults from .env (same file that holds QCOBRO_VERSION) if present.
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

DOMAIN="${TLS_DOMAIN:-}"
API_DOMAIN="${TLS_API_DOMAIN:-}"
EMAIL="${TLS_EMAIL:-}"
RENEW_DAYS="${TLS_DAYS:-30}"
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --domain)     DOMAIN="$2";     shift 2 ;;
    --api-domain) API_DOMAIN="$2"; shift 2 ;;
    --email)      EMAIL="$2";      shift 2 ;;
    --days)       RENEW_DAYS="$2"; shift 2 ;;
    --force)      FORCE=1;         shift ;;
    -h|--help)
      sed -n '2,33p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

[ -n "$DOMAIN" ] || { echo "tls.sh: TLS_DOMAIN not set (use --domain or .env)" >&2; exit 1; }
[ -n "$EMAIL" ]  || { echo "tls.sh: TLS_EMAIL not set (use --email or .env)" >&2; exit 1; }

# Run privileged steps as root; no-op prefix when already root.
SUDO=""
[ "$(id -u)" -eq 0 ] || SUDO="sudo"

LIVE_DIR="/etc/letsencrypt/live/$DOMAIN"
HOOK="$REPO_DIR/scripts/deploy/refresh-envoy-certs.sh"
chmod +x "$HOOK" "$SCRIPT_DIR/tls.sh" 2>/dev/null || true

# Build the domain flags for certbot (primary + optional API domain).
DOMAIN_FLAGS="-d $DOMAIN"
[ -n "$API_DOMAIN" ] && DOMAIN_FLAGS="$DOMAIN_FLAGS -d $API_DOMAIN"

# ── First issuance ───────────────────────────────────────────────────────────
if [ ! -f "$LIVE_DIR/privkey.pem" ]; then
  echo "tls.sh: no certificate for $DOMAIN yet — issuing (standalone, port 80)…"
  # shellcheck disable=SC2086
  $SUDO certbot certonly --standalone $DOMAIN_FLAGS \
    --agree-tos -m "$EMAIL" --non-interactive \
    --deploy-hook "$HOOK"
  echo "tls.sh: issued and installed into Envoy."
  exit 0
fi

# ── SAN expansion (add API domain to existing cert, one-time) ────────────────
if [ -n "$API_DOMAIN" ]; then
  if ! $SUDO openssl x509 -noout -text -in "$LIVE_DIR/fullchain.pem" 2>/dev/null \
       | grep -q "DNS:$API_DOMAIN"; then
    echo "tls.sh: cert does not yet cover $API_DOMAIN — expanding (adds a SAN)…"
    # --force-renewal is required: certbot --expand still checks the expiry
    # gate and refuses to re-issue when the cert is not near expiry, even
    # when new SANs are being added. One forced issuance per new domain is
    # well within Let's Encrypt's rate limits.
    # shellcheck disable=SC2086
    $SUDO certbot certonly --standalone --expand --force-renewal $DOMAIN_FLAGS \
      --agree-tos -m "$EMAIL" --non-interactive \
      --deploy-hook "$HOOK"
    echo "tls.sh: expanded and installed into Envoy."
    exit 0
  fi
fi

# ── Renewal window check (rate-limit-safe) ───────────────────────────────────
END="$($SUDO openssl x509 -enddate -noout -in "$LIVE_DIR/fullchain.pem")"
END="${END#notAfter=}"
END_EPOCH="$(date -d "$END" +%s)"
NOW_EPOCH="$(date +%s)"
DAYS_LEFT=$(( (END_EPOCH - NOW_EPOCH) / 86400 ))
echo "tls.sh: $DOMAIN cert expires in ${DAYS_LEFT} day(s) (renewal window: ${RENEW_DAYS} days)."

if [ "$DAYS_LEFT" -gt "$RENEW_DAYS" ] && [ "$FORCE" -ne 1 ]; then
  echo "tls.sh: outside renewal window — nothing to do."
  exit 0
fi

# ── Renew ────────────────────────────────────────────────────────────────────
# `certbot renew` is itself rate-limit-safe (skips certs not yet due); the
# deploy-hook copies the new cert in and restarts Envoy only on an actual renewal.
if [ "$FORCE" -eq 1 ]; then
  echo "tls.sh: --force given — forcing renewal (counts against Let's Encrypt rate limits)."
  $SUDO certbot renew --cert-name "$DOMAIN" --force-renewal --deploy-hook "$HOOK"
else
  echo "tls.sh: inside renewal window — running certbot renew…"
  $SUDO certbot renew --cert-name "$DOMAIN" --deploy-hook "$HOOK"
fi
echo "tls.sh: done."
