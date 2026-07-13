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

#### The sim → eval loop

Simulation and evaluation are one workflow: `engine:sim` runs the **real engine** with
**emulated** channels (real DB writes and reservations, nothing actually dialed or
texted), every tick writes an append-only **flight recorder** stream to `engine_events`
(tick lifecycle, campaign evaluations, per-account decisions, dispatch attempts), and
`engine-eval` replays that stream through a pure **judge** that proves the run stayed
within parameters. Same recorder, same judge, whether the ticks came from a sim or from
production.

End to end from a fresh checkout (dev stack up, migrations applied):

1. **Seed the demo** (idempotent — user, portfolio + accounts, agents, and three
   **ACTIVE** campaigns):

   ```bash
   npm run db:seed --workspace=mods/apiserver   # login: demo@qcobro.com / password123
   ```

2. **Simulate a few ticks.** `SIM_AT=<iso>` pins the engine clock so you can run
   "inside" the campaign window (Mon–Fri 09:00–18:00, workspace timezone) at any
   wall-clock time; `SIM_TICKS=<n>` runs consecutive ticks:

   ```bash
   SIM_AT="2026-07-11T15:00:00-04:00" SIM_TICKS=4 npm run engine:sim --workspace=mods/apiserver
   ```

   It prints a **TickReport** — each campaign's in-window status and a per-account
   decision (`dispatched` / `daily_cap` / `promise_suppressed` / …) — and records the
   flight-recorder events. The attempts land as real gestiones (check the **Gestiones**
   page); re-running shows `daily_cap` once accounts hit `maxAttemptsPerDay` — the
   at-most-once guarantee at work.

3. **Mint a workspace API key** for the seeded demo workspace (`engine-eval`
   authenticates with a workspace API key pair; the secret is printed once):

   ```bash
   npm run apikey:create --workspace=mods/apiserver
   ```

4. **Start the apiserver** (it serves `GET /api/engine/events`, the flight-recorder
   export the CLI reads):

   ```bash
   npm run start:dev --workspace=mods/apiserver
   ```

5. **Judge the run.** No repo checkout or DB access is needed on the machine that runs
   this — only the URL and the key pair (`--url` defaults to `https://api.qcobro.com`;
   point it at your apiserver for local runs):

   ```bash
   npx -p @qcobro/common engine-eval --url http://localhost:3000 \
     --access-key-id <accessKeyId> --access-key-secret <accessKeySecret>
   ```

   ```
   VERDICT: PASS

   INVARIANTS
     [PASS]  SAF-1   window compliance       workspace
     [PASS]  SAF-5   channel rate caps       deployment  peak 9.0/min on SMS
     [PASS]  PERF-3  dispatch error rate     workspace   worst 0.0%
     [PASS]  LIVE-1  ticks to first attempt  workspace   max streak 4
     ...

   BY CAMPAIGN
     campaign              ticks  considered  dispatched  failed  suppressed  violations
     Recuperación Q2 2026      4          40          18       0          22  -
     Cobro Compulsivo          4          40          18       0          16  -
   ```

Reading the card: **SAF-\*** are safety invariants (window compliance, lifetime/daily
attempt caps, suppression respected, per-channel rate caps, at-most-once dispatch),
**PERF-\*** are thresholds (tick duration, dispatch latency p95, error rate, budget
utilization), **LIVE-1** catches starved accounts. Any violation names the campaign, the
account, and the exact event ids that evidence it. The scorecard is scoped to the API
key's workspace (plus the deployment-level tick events that back the `deployment`-scoped
rows).

Useful flags: no `--from`/`--to` evaluates **today** in your local timezone (pass a range
to audit an older window); `--json` for machine-readable output; `--latency-p95` /
`--max-error-rate` / `--liveness-ticks` to tighten thresholds; the key pair also falls
back to `QCOBRO_ACCESS_KEY_ID` / `QCOBRO_ACCESS_KEY_SECRET`. Exit codes: `0` pass, `1`
fail, `2` usage/auth/network — wire it into a post-deploy check. Recorded events are kept
for `engine.eventsRetentionDays` (`qcobro.json`, `0` disables pruning).

**Run it for real** (⚠️ places real calls/SMS): set `engine.enabled: true` and configure
`fonoster` / `twilio` in `qcobro.json`, then start the apiserver — it ticks every
`engine.tickSeconds`, guarded by a Postgres advisory lock so only one instance dispatches.
The flight recorder runs identically in production, so step 5 works unchanged against a
live deployment — that's the point.

### Cleaning up gestiones from a test run

Sim runs and manual test dispatches write **real** gestiones (`account_contact_logs`,
cascading to `payment_promises`) — there's no separate test data path. To wipe one
customer's history on a shared DB (e.g. a DigitalOcean managed Postgres you don't have
`psql` installed next to), run the official Postgres image against it:

```bash
docker run --rm -i postgres:16 psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

SELECT pa."externalId", pa.id AS portfolio_account_id,
       count(acl.id) AS gestiones_to_delete,
       count(pp.id) AS payment_promises_to_cascade
FROM "portfolio_accounts" pa
LEFT JOIN "account_contact_logs" acl ON acl."portfolioAccountId" = pa.id
LEFT JOIN "payment_promises" pp ON pp."contactLogId" = acl.id
WHERE pa."externalId" = 'LN001023'
GROUP BY pa."externalId", pa.id;

DELETE FROM "account_contact_logs"
WHERE "portfolioAccountId" IN (
  SELECT id FROM "portfolio_accounts" WHERE "externalId" = 'LN001023'
);

COMMIT;
SQL
```

Swap `'LN001023'` (in both places) for the account's `externalId`. `payment_promises`
cascade-delete automatically via the `contactLogId` FK, so no separate statement is
needed. `DATABASE_URL` must include `?sslmode=require` for a DO managed database, and is
expanded by your shell before `docker run` starts, so it doesn't need to exist inside the
container. Note `externalId` is unique per portfolio, not globally — this matches the
customer across every portfolio they appear in.

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

## Admin Commands

One-off operator tooling, published as `npx`-runnable bins in `@qcobro/common`
(no repo checkout needed) — the same package/pattern as `engine-eval` above. This
section grows as new admin commands are added; each one gets its own subsection.

### `list-users` — account census

Users and workspaces live in **Fonoster Identity's own Postgres database** (separate
from the qcobro app DB — see `database.url` in `identity.json`), and Identity's gRPC
surface has no admin-wide "list all users" call (`listWorkspaces`/`listWorkspaceMembers`
are scoped to the caller's own token). `list-users` connects to that database directly
and prints every user with their signup date and workspace count (owned + member,
deduplicated), newest signups first:

```bash
npx -p @qcobro/common list-users --database-url "$QCOBRO_IDENTITY_DATABASE_URL"
# or export QCOBRO_IDENTITY_DATABASE_URL first and drop the flag
```

```
  email               name    created     workspaces
  dana@example.com    Dana    2026-07-10  2
  bruno@example.com   Bruno   2026-06-28  1
  camila@example.com  Camila  2026-06-02  0
```

`--json` prints the same rows as JSON instead of a table. The connection string must
include `?sslmode=require` for a DO managed database — matching the "Cleaning up
gestiones" pattern above, `list-users` treats `sslmode=require` as "encrypted, not
verified" (libpq/psql semantics), not node-postgres's stricter default.

**Running it from a droplet with no local Node install** — any container with npm/npx
works, e.g. the official Node image (same version this repo builds with):

```bash
docker run --rm -it \
  -e QCOBRO_IDENTITY_DATABASE_URL="postgresql://user:pass@identity-db-host:25060/identity?sslmode=require" \
  node:22-alpine \
  npx -p @qcobro/common list-users
```

**Planned** (not yet built — see [issue #42](https://github.com/fonoster/qcobro/issues/42)
for the full backlog): `list-workspaces` (name, owner, member count, plan/billing
status), `list-orphaned-workspaces` (cleanup candidates), `billing-summary`
(per-workspace plan/cycle/credit balance), `list-unverified-users` (signup funnel).

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

### Billing (Stripe)

Usage-based billing meters every dispatch (SMS, email, WhatsApp, both voice modes) into
a durable ledger priced at write time, grants a monthly credit allowance per plan, and
**hard-stops** collections when a workspace's credits run out (no overage). Add a
`billing` block to `qcobro.json` (see the example config for the full plan catalog):

```jsonc
"billing": {
  "enabled": false,                 // master switch: metering + gating + Stripe
  "currency": "USD",
  "stripe": {
    "secretKey": "sk_live_...",
    "webhookSigningSecret": "whsec_..."
  },
  "voiceDebitEstimateSeconds": 60,  // pre-dispatch voice debit, settled at call end
  "plans": [ /* ordered array — index order IS the upgrade path */ ]
}
```

Voice bills by telecom increments (`"15/15"` = every started 15s block, answered time
only — voicemail pickup counts as answered, unanswered calls bill zero). Message meters
bill per message. Each plan needs a Stripe **price** (`stripePriceId`); at startup the
apiserver warns when a price's amount drifts from the plan's `monthlyPrice`.

#### Configuring plans (QCobro ↔ Stripe)

A plan lives in **two places that must agree**: the `qcobro.json` catalog (what a
workspace gets: allowance + per-channel rates) and a Stripe **recurring price** (what the
card is charged). Setting one up:

1. **Stripe** (dashboard or CLI): create a product per plan and a monthly recurring
   price for it, in the billing currency:

   ```sh
   stripe products create --name "QCobro Growth"
   stripe prices create --product prod_... --currency usd \
     --unit-amount 2900 --recurring.interval month     # 29.00/mo
   ```

2. **qcobro.json**: add the plan to `billing.plans`. **Array order is the upgrade
   path** — index 0 is the cheapest, and the console's "Mejorar plan" walks up the
   array. Every plan must price **all seven meters**:

   ```jsonc
   {
     "key": "growth", // stable id, kebab-case — never rename once sold
     "name": { "en": "Growth", "es": "Crecimiento" },
     "monthlyPrice": 29, // must match the Stripe price amount
     "monthlyAllowance": 29, // credits granted each cycle (may differ: "pay 29, get 35")
     "stripePriceId": "price_...", // the price created in step 1
     "rates": {
       "sms": { "perMessage": 0.008 },
       "email": { "perMessage": 0.0004 },
       "whatsappMessage": { "perMessage": 0.01 },
       "voicePrerecorded": { "perMinute": 0.28, "increments": "15/15" },
       "voiceAi": { "perMinute": 0.4, "increments": "15/15" },
       "whatsappVoicePrerecorded": { "perMinute": 0.08, "increments": "15/15" }, // reserved
       "whatsappVoiceAi": { "perMinute": 0.8, "increments": "15/15" } // reserved
     }
   }
   ```

3. **Restart the apiserver** and check the logs: it validates the catalog (duplicate
   keys, missing meters, malformed increments all fail boot) and warns on
   `[billing] price drift` when a `stripePriceId` charges a different amount than
   `monthlyPrice`. Run `npm run billing:sim` to confirm the margin guard (BIL-5) —
   it flags any rate below its provider floor so a plan can't sell channels at a loss.

Rules of thumb: **changing a rate** is just a config edit — history never reprices
(records are priced at write time), new dispatches use the new rate on the next restart.
**Changing a monthly price** needs a NEW Stripe price (Stripe prices are immutable) —
create it, swap the plan's `stripePriceId`, restart; existing subscriptions keep the old
price until their next plan change. **Adding a plan** is append (or insert at its rank
in the upgrade path). **Never delete or rename a plan key** that workspaces still
reference — the engine fails closed (`credits_exhausted`) for workspaces pointing at an
unknown key.

**Stripe webhook**: add an endpoint for `checkout.session.completed`, `invoice.paid`,
and `invoice.payment_failed` pointing at `POST https://<host>/api/stripe/webhook`
(signature-verified; all effects idempotent), and put its signing secret in
`billing.stripe.webhookSigningSecret`. One Stripe customer per payer holds ONE
subscription with one item per workspace, so an owner with several workspaces gets a
single monthly charge on one card.

**Rollout**: ship with `enabled:false` (no metering, no gating — also the rollback
switch). Enroll workspaces by creating their `WorkspaceBilling` rows (or via checkout);
unenrolled workspaces keep dispatching unmetered, which is what makes gradual backfill
safe. Verify the module any time with the in-memory scenario suite:

```sh
npm run billing:sim --workspace=mods/apiserver   # hard stop, proration, overshoot, replays + BIL-1…6
```

**Enterprise**: set the billing account's `collectionMethod` to `send_invoice` (Stripe
emails the invoice; cycles turn over on payment exactly as with cards) and put
per-workspace negotiated rates in `WorkspaceBilling.rateOverrides` (a partial of the
rates schema — e.g. custom `"60/6"` voice increments).

**Ownership transfer runbook**: Stripe cannot move a subscription between customers. To
move a workspace to a new payer: schedule/cancel its item on the old subscription at
period end, then subscribe the workspace from the new owner's account (checkout or item
add). The ledger keys on `workspaceRef`, so usage history is unaffected.

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
