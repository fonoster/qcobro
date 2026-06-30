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
mkdir -p config
cp config/qcobro.example.json config/qcobro.json
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
sudo mkdir -p /opt/qcobro/config/identity/keys /opt/qcobro/config/identity/templates /opt/qcobro/scripts/deploy && cd /opt/qcobro
BASE=https://raw.githubusercontent.com/fonoster/qcobro/$REL
curl -fsSL $BASE/compose.yaml                          -o compose.yaml
curl -fsSL $BASE/config/envoy.yaml                     -o config/envoy.yaml
curl -fsSL $BASE/config/qcobro.example.json            -o config/qcobro.json
curl -fsSL $BASE/config/identity/identity.example.json -o config/identity/identity.json
curl -fsSL $BASE/scripts/deploy/tls.sh                 -o scripts/deploy/tls.sh
curl -fsSL $BASE/scripts/deploy/refresh-envoy-certs.sh -o scripts/deploy/refresh-envoy-certs.sh
chmod +x scripts/deploy/tls.sh scripts/deploy/refresh-envoy-certs.sh
# QCobro-branded Identity email/SMS templates (bind-mounted by compose.yaml;
# refreshed on every deploy by the Deploy workflow).
for t in verifyEmail verifyPhone inviteNewUser inviteExistingUser resetPassword; do
  curl -fsSL $BASE/config/identity/templates/$t.hbs -o config/identity/templates/$t.hbs
done

Configure the app + Identity service (fill every CHANGE_ME / REPLACE_* —
managed-DB urls with `sslmode=require`, keys, SMTP, announcement banner, …)

# 3. Generate Identity's RSA signing keys (referenced by identity.json). The
#    encryptionKey there is a Cloak key — generate one anywhere with Node via
#    `npx --yes @47ng/cloak generate`.
openssl genrsa -out config/identity/keys/private.pem 2048
openssl rsa -in config/identity/keys/private.pem -pubout -out config/identity/keys/public.pem
chmod 644 config/identity/keys/private.pem config/identity/keys/public.pem

# 4. Pin the version + TLS settings (compose.yaml reads QCOBRO_VERSION from .env;
#    scripts/deploy/tls.sh reads TLS_DOMAIN/TLS_API_DOMAIN/TLS_EMAIL).
#    TLS_API_DOMAIN adds api.qcobro.com as a SAN on the same cert so the SDK
#    endpoint (https://api.qcobro.com) is also TLS-terminated by Envoy.
cat > .env << ENV
QCOBRO_VERSION=$REL
TLS_DOMAIN=app.qcobro.com
TLS_API_DOMAIN=api.qcobro.com
TLS_EMAIL=team@fonoster.com
ENV

# 5. Issue the TLS cert (port 443 is free on first run, so certbot uses port 80).
#    tls.sh issues it, copies it where Envoy reads it (config/certs — see the
#    userns-remap note in docs/deploy.md), and wires automatic renewal.
sudo apt update && sudo apt install -y certbot
scripts/deploy/tls.sh

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
sed -i "s/^QCOBRO_VERSION=.*/QCOBRO_VERSION=v1.1.0/" .env   # the new release
docker compose pull
docker compose up -d
```

> The CI **Deploy** workflow does this for you on each release (it also re-fetches
> the version-pinned `compose.yaml`, `config/envoy.yaml`, `scripts/deploy/*`, and
> the QCobro-branded `config/identity/templates/*.hbs`).

TLS renews automatically: `scripts/deploy/tls.sh` (run at install and on every
deploy) wires a certbot deploy-hook that copies the renewed cert into
`config/certs` and restarts Envoy. It also respects Let's Encrypt rate limits —
it only renews inside the expiry window. See **[`docs/deploy.md`](docs/deploy.md)**.

## Configuration

All deployment settings live in `qcobro.json` (Zod-validated, never committed).
`config/qcobro.example.json` is the documented template. Changes require an apiserver
restart (`docker compose up -d`).

### Email channel (Resend)

EMAIL is a bidirectional, autopilot channel (send a notice → the customer replies →
the agent's system prompt decides reply/ignore/resolve/escalate, capped per case). Add a
`resend` block to `qcobro.json`:

```jsonc
"resend": {
  "apiKey": "re_...",
  "fromEmail": "cobranza@yourdomain.com",
  "fromName": "Your Brand",
  "inboundDomain": "inbound.yourdomain.com", // reply-to: reply+<token>@<inboundDomain>
  "inboundSigningSecret": "shared-secret",   // required on the inbound webhook
  "maxEmailsPerMinute": 60,
  "maxRepliesDefault": 3                      // per-case autopilot reply ceiling
}
```

Add a Resend webhook for the **`email.received`** event pointing at
`POST https://<host>/api/email/inbound`. The handler verifies the **Svix signature**
(standard-webhooks: `svix-id` / `svix-timestamp` / `svix-signature` headers) using
`inboundSigningSecret` — copy that secret from the Resend webhook's settings. When
`resend` is absent, EMAIL campaigns are skipped as `channel_not_configured` and the
webhook returns `503`; a bad signature returns `401`.

### Production integrations & webhooks

In production, Envoy terminates TLS on port 443 and routes `/trpc` and `/api/*` to the
apiserver. **Every webhook and the SDK endpoint are reachable on the same Envoy listener
with no extra port mapping** — both app and API domains must resolve to the same IP.

**DNS** (assuming app domain `app.qcobro.com`, email domain `notices.qcobro.com`):

| Record | Host                 | Value              | Purpose                                             |
| ------ | -------------------- | ------------------ | --------------------------------------------------- |
| `A`    | `app.qcobro.com`     | Droplet IP         | Console + webhooks (Envoy `:443`)                   |
| `A`    | `api.qcobro.com`     | Droplet IP         | SDK endpoint (same Envoy listener, SAN on TLS cert) |
| `MX`   | `notices.qcobro.com` | Resend inbound MX  | Receives debtor replies (`reply+<token>@notices.…`) |
| `TXT`  | per Resend           | SPF / DKIM / DMARC | Sending-domain auth (shown in the Resend dashboard) |

Two sender identities must be domain-verified in Resend: `cobranza@notices.qcobro.com`
(collections, `qcobro.json` → `resend.fromEmail`) and `no-reply@qcobro.com` (Identity
verification/invite emails, sent via Resend SMTP — see below).

**`config/qcobro.json`** — production-specific fields beyond the Email block above:

| Field                                   | Production value         | Notes                                                        |
| --------------------------------------- | ------------------------ | ------------------------------------------------------------ |
| `identity.endpoint`                     | `identity:50051`         | internal gRPC over the Docker network                        |
| `identity.httpBridgeUrl`                | `http://identity:9110`   | internal — the apiserver calls the accept-invite bridge here |
| `fonoster.webhookBaseUrl`               | `https://app.qcobro.com` | Voz IA events-hook auto-registers at `…/api/voice/events`    |
| `fonoster.accessKeyId/apiKey/apiSecret` | from Fonoster workspace  | authenticates the autopilot sync                             |
| `fonoster.numbers`                      | provisioned caller-IDs   | carrier format (no leading `+` for the current pool)         |
| `twilio.*`                              | from Twilio              | **outbound-only — no Twilio webhook exists**                 |
| `resend.inboundDomain`                  | `notices.qcobro.com`     | must match the `MX` record                                   |
| `ai.apiKey` / `tts.apiKey`              | Gemini / ElevenLabs keys | no callbacks                                                 |
| `engine.enabled`                        | `true`                   | the autonomous outreach loop (off by default)                |
| `apiserver.contactLogAuth.enabled`      | `true`                   | enforces workspace Basic auth on `POST /api/contact-logs`    |

**`config/identity/identity.json`** — URLs used by the verification/invite emails and the
accept-invite bridge (this file is install-once on the droplet, like the keys):

| Field                                  | Production value                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `appUrl`                               | `https://app.qcobro.com`                                                       |
| `invite.url`                           | `https://app.qcobro.com/accept-invite`                                         |
| `invite.failUrl`                       | `https://app.qcobro.com/invite-failed`                                         |
| `smtp`                                 | `smtp.resend.com:465`, `secure:true`, `auth.user:"resend"`, `auth.pass:"re_…"` |
| `smtp.sender`                          | `QCobro <no-reply@notices.qcobro.com>`                                         |
| `security.contactVerificationRequired` | `true`                                                                         |

**External dashboards** — only Resend needs a hand-created webhook:

- **Resend** — verify both sender domains; add the inbound `MX`; create the
  `email.received` webhook → `https://<host>/api/email/inbound` and copy its signing
  secret into `resend.inboundSigningSecret`.
- **Fonoster** — no manual webhook. Set `webhookBaseUrl` + credentials + caller-ID
  numbers; the apiserver registers the Voz IA events-hook when an agent is synced.
- **Twilio / Gemini / ElevenLabs** — credentials/keys only; no callbacks.

**Known limitations** (as of this writing):

- **Voz IA only.** Pre-recorded voice needs the embedded VoiceServer on gRPC `:50061`,
  which Envoy/compose do not expose publicly yet. `prerecordedAppRef` can be set, but
  only the autopilot (Voz IA) path functions.
- **`POST /api/voice/events` is unauthenticated** (tracked `FIXME(security)` in the
  handler) — secure it before relying on it in production.

## More

The complete deploy runbook — GHCR images, certificates, renewal hooks, the secrets
checklist, and troubleshooting — is in **[`docs/deploy.md`](docs/deploy.md)**.
