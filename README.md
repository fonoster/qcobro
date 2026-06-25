# QCobro

QCobro (by Fonoster) is a multilingual AI-voice debt-collections platform — a
React operator console backed by a tRPC API over PostgreSQL, with voice/SMS/email
outreach.

## Local development

**Prerequisites:** Node 22 and Docker.

```bash
# 1. Backing services (Postgres, Identity, Mailpit) on localhost
docker compose -f compose.dev.yaml up -d

# 2. Config — point at the dev DB. The engine stays OFF by default (never auto-dials)
cp qcobro.example.json qcobro.json
#   set database.url to:
#   postgresql://qcobro:qcobro@localhost:5432/qcobro?schema=public

# 3. Database — apply migrations (and an optional demo seed)
npm run db:migrate --workspace=mods/apiserver
npm run db:seed    --workspace=mods/apiserver   # optional
# Starting over? Drop all app data + re-apply migrations, then re-seed (dev only):
#   npm run db:reset --workspace=mods/apiserver && npm run db:seed --workspace=mods/apiserver

# 4. Run the API + console
npm run start:dev      # apiserver on :3000
npm run start:webapp   # console on :5173
```

### Running the campaigns engine

The engine is the autonomous loop that originates outreach. It is **off by default**
(`engine.enabled: false`) so it never dials in development.

**Simulate one tick** — runs the real engine with **emulated** channels (real DB writes,
nothing actually dialed or texted):

```bash
npm run engine:sim --workspace=mods/apiserver
```

Try it end to end:

1. Seed a complete demo (idempotent — user, portfolio + accounts, agents, and three
   **ACTIVE** campaigns scheduled Mon–Fri 09:00–18:00):

   ```bash
   npm run db:seed --workspace=mods/apiserver   # login: demo@qcobro.com / password123
   ```

2. Run `npm run engine:sim` **during the campaign window** (Mon–Fri, 09:00–18:00 in the
   deployment timezone). It prints a **TickReport**: each campaign's in-window status and
   a per-account decision (`dispatched` / `daily_cap` / `promise_suppressed` / …), plus
   the would-be dispatches (emulated). The SMS and Voz-pregrabada campaigns dispatch; the
   Voz IA one shows `voice_not_synced` until Fonoster is configured. Outside the window
   every campaign is `out_of_window`.
3. Open the **Gestiones** page — the simulated attempts are recorded as real gestiones.
4. Run the sim a few more times: once an account reaches `maxAttemptsPerDay` it shows
   `daily_cap` — proof of at-most-once (it is never dialed beyond its cap).

**Run it for real** (⚠️ places real calls/SMS): set `engine.enabled: true` and configure
`fonoster` / `twilio` in `qcobro.json`, then start the apiserver — it ticks every
`engine.tickSeconds`, guarded by a Postgres advisory lock so only one instance dispatches.

### Verifying behavior matches the spec

Product behavior lives in OpenSpec specs (`openspec/`); the tests are the executable
proof of those specs.

```bash
# The spec is internally consistent
openspec validate campaigns-engine

# Unit tests — window gate, eligibility funnel, pacing, reserve/record
# (integration tests auto-skip without a DB)
npm test --workspace=mods/apiserver

# Integration tests — prove at-most-once end to end against the dev DB
DATABASE_URL=postgresql://qcobro:qcobro@localhost:5432/qcobro?schema=public \
  npm test --workspace=mods/apiserver
```

Spec ↔ test map (a few):

| Spec requirement                                                  | Test                                        |
| ----------------------------------------------------------------- | ------------------------------------------- |
| Schedule-window gate (`campaigns-engine`)                         | `engine/window.test.ts`                     |
| Account eligibility funnel + reasons                              | `engine/funnel.test.ts`                     |
| At-most-once dispatch (re-tick + crash)                           | `engine/engine.integration.test.ts`         |
| One gestión per attempt / never-downgrade (`account-contact-log`) | `functions/campaigns/recordOutcome.test.ts` |

## Architecture (production)

A single DigitalOcean Droplet running Docker Compose. Envoy terminates TLS on
`:443` and reverse-proxies to the containers on an internal network:

| Service       | Role                                           |
| ------------- | ---------------------------------------------- |
| **envoy**     | TLS termination + reverse proxy (`:443`)       |
| **webapp**    | React console (static build)                   |
| **apiserver** | tRPC API; runs `prisma migrate deploy` on boot |
| **identity**  | Fonoster Identity — auth, authz, multi-tenancy |

PostgreSQL is **not** a container — use a DigitalOcean Managed Database.

## Deploy to DigitalOcean (production)

Images are built and published by CI on every `vX.Y.Z` release tag
(`.github/workflows/docker-publish.yml` → `ghcr.io/fonoster/qcobro-apiserver`
and `…/qcobro-webapp`). **The server only pulls pre-built images — nothing is
built on the Droplet.**

**Prerequisites:** an Ubuntu 22.04+ Droplet (≥2 GB RAM) with Docker + Compose
(plus `curl` and `openssl`), the `app.qcobro.com` A-record pointed at the Droplet,
a DO Managed PostgreSQL cluster, and a GitHub token with `read:packages` to pull
from GHCR. No repo clone and no build are needed on the server.

```bash
REL=v1.0.0   # the release to deploy

# 1. Fetch only the files the stack needs, straight from GitHub (no clone)
sudo mkdir -p /opt/qcobro/config/identity/keys && cd /opt/qcobro
BASE=https://raw.githubusercontent.com/fonoster/qcobro/$REL
curl -fsSL $BASE/compose.yaml                          -o compose.yaml
curl -fsSL $BASE/config/envoy.yaml                     -o config/envoy.yaml
curl -fsSL $BASE/qcobro.example.json                   -o qcobro.example.json
curl -fsSL $BASE/config/identity/identity.example.json -o config/identity/identity.example.json

# 2. Configure the app + Identity service (fill every CHANGE_ME / REPLACE_* —
#    managed-DB urls with `sslmode=require`, keys, SMTP, announcement banner, …)
cp qcobro.example.json qcobro.json && "$EDITOR" qcobro.json
cp config/identity/identity.example.json config/identity/identity.json \
  && "$EDITOR" config/identity/identity.json

# 3. Generate Identity's RSA signing keys (referenced by identity.json). The
#    encryptionKey there is a Cloak key — generate one anywhere with Node via
#    `npx --yes @47ng/cloak generate`.
openssl genrsa -out config/identity/keys/private.pem 2048
openssl rsa -in config/identity/keys/private.pem -pubout -out config/identity/keys/public.pem

# 4. Issue a TLS cert (port 443 is free on first run). Envoy already reads the
#    cert from /etc/letsencrypt/live/app.qcobro.com/ — no config edit needed.
sudo apt update && sudo apt install -y certbot
sudo certbot certonly --standalone -d app.qcobro.com \
  --agree-tos -m ops@qcobro.com --non-interactive

# 5. Pin the version (compose.yaml reads QCOBRO_VERSION from this .env file)
echo "QCOBRO_VERSION=$REL" > .env

# 6. Authenticate to GHCR, pull the pinned images, and launch (migrations run
#    automatically). No local re-tagging.
echo "$CR_PAT" | docker login ghcr.io -u <github-username> --password-stdin
docker compose pull
docker compose up -d
```

> **Keys & secrets are never in the repo.** The Identity signing keys in
> `config/identity/keys/` contain a **private key**, so they are git-ignored and
> generated on the server (step 3). `qcobro.json` and `config/identity/identity.json`
> are likewise git-ignored — only their `*.example.json` templates live in GitHub.
> The `encryptionKey` in `identity.json` is a Cloak key; generate one (on any
> machine with Node) with `npx --yes @47ng/cloak generate`.

**Verify:**

```bash
docker compose ps                        # containers should be Up
curl https://app.qcobro.com/health       # 200 OK through Envoy
```

### Updating

Bump the version in `.env`, then pull and redeploy (migrations run
automatically):

```bash
echo "QCOBRO_VERSION=v1.1.0" > .env   # the new release
docker compose pull
docker compose up -d
```

Certbot renews certs via its systemd timer; add a deploy hook to restart Envoy
after renewal (see the full guide).

## Configuration

All deployment settings live in `qcobro.json` (Zod-validated, never committed).
`qcobro.example.json` is the documented template. Changes require an apiserver
restart (`docker compose up -d`).

## More

The complete guide — GHCR images, DNS-01 certificates, renewal hooks, the secrets
checklist, and troubleshooting — is in **[`docs/deploy.md`](docs/deploy.md)**.
