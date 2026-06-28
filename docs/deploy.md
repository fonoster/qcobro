# QCobro — Production Deployment on DigitalOcean

QCobro runs on its own Droplet. Envoy terminates TLS on port 443 and routes
traffic to the apiserver and webapp containers on the internal Docker network.

---

## Prerequisites

- A DigitalOcean Droplet (Ubuntu 22.04+, ≥2 GB RAM recommended).
- Docker and Docker Compose installed on the Droplet.
- A domain pointed at the Droplet's IP (e.g. `app.qcobro.com` A-record).
- SSH access as a user with `docker` and `sudo` rights.

---

## Step 1 — Clone the repository

```bash
cd /opt
git clone https://github.com/your-org/qcobro.git
cd qcobro
```

---

## Step 2 — Configure QCobro

```bash
cp qcobro.example.json config/qcobro.json
```

Edit `config/qcobro.json` and fill in all `CHANGE_ME` values. Key fields for
production:

```json
{
  "database": {
    "url": "postgresql://<user>:<password>@<do-managed-db-host>:25060/qcobro?schema=public&sslmode=require"
  },
  "identity": {
    "endpoint": "identity:50051",
    "httpBridgeUrl": "http://identity:9110"
  },
  "apiserver": {
    "port": 3000
  }
}
```

The database URL comes from your DigitalOcean managed PostgreSQL cluster's
connection string (found under **Databases → your cluster → Connection details**).
Use the `sslmode=require` parameter — DO managed databases require SSL.

`identity.httpBridgeUrl` is the **internal** address of the Identity HTTP bridge
(`http://identity:9110`), not a public URL: the apiserver calls it server-side over
the Docker network to accept invitations. Identity's port is not exposed publicly.
See the README's _Production integrations & webhooks_ section for the full URL/webhook
map (DNS, Resend inbound, Fonoster, and the `identity.json` invite/verification URLs).

> `qcobro.json` is never committed — it's listed in `.gitignore`.

---

## Step 3 — Point the domain's DNS at the Droplet

Create an `A` record for your domain (e.g. `app`) pointing at the Droplet's
public IPv4. Confirm it resolves before issuing a cert:

```bash
dig +short app.qcobro.com A      # must return the Droplet's IP
```

The Envoy config (`config/envoy.yaml`) is domain-agnostic — it reads its cert
from `config/certs/`, which `scripts/deploy/tls.sh` populates (see Step 4). You
do **not** need to edit `envoy.yaml` per domain.

---

## Step 4 — Issue and manage the TLS certificate

TLS is handled by `scripts/deploy/tls.sh`. Set the domain and ACME email in the
`.env` next to `compose.yaml` (the same file that pins `QCOBRO_VERSION`):

```bash
cat >> .env << 'EOF'
TLS_DOMAIN=app.qcobro.com
TLS_EMAIL=team@fonoster.com
EOF

sudo apt update && sudo apt install -y certbot
scripts/deploy/tls.sh
```

What the script does (and why it's safe to run on every deploy):

- **First run** — issues the cert via `certbot --standalone` (Envoy uses only
  443, so port 80 is free for the HTTP-01 challenge) and registers a renewal
  deploy-hook.
- **Later runs** — checks days-to-expiry and only calls certbot when inside the
  renewal window (default 30 days). Far from expiry it's a fast no-op that never
  touches certbot, so it can't burn Let's Encrypt rate limits.
- The deploy-hook (`scripts/deploy/refresh-envoy-certs.sh`) copies the cert into
  `config/certs/` and restarts Envoy — and only runs on an _actual_ renewal.

> **Why copy the certs?** This Droplet runs Docker with **userns-remap**, so the
> Envoy container's root maps to an unprivileged host UID that cannot read
> certbot's `0600` key or traverse its `0700` `live`/`archive` dirs. Envoy
> therefore reads world-readable (`0644`) copies from `config/certs/` instead of
> mounting `/etc/letsencrypt` directly. `config/certs/` is git-ignored.

To force a renewal regardless of the window (counts against rate limits):

```bash
scripts/deploy/tls.sh --force
```

---

## Step 5 — Build the Docker images

### Option A — Pull from GitHub Container Registry (recommended)

Tag a release in git to trigger the `docker-publish` workflow:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

Then on the server:

```bash
echo $CR_PAT | docker login ghcr.io -u <github-username> --password-stdin

docker pull ghcr.io/<org>/qcobro-apiserver:v1.0.0
docker pull ghcr.io/<org>/qcobro-webapp:v1.0.0

# Tag as "latest" so compose.yaml picks them up
docker tag ghcr.io/<org>/qcobro-apiserver:v1.0.0 qcobro-apiserver:latest
docker tag ghcr.io/<org>/qcobro-webapp:v1.0.0    qcobro-webapp:latest
```

### Option B — Build on the server

Requires both the qcobro and fonoster repos cloned as siblings:

```bash
cd /opt
git clone https://github.com/fonoster/fonoster.git

cd /opt/qcobro
./scripts/docker-build.sh --tag latest
```

---

## Step 6 — Deploy

```bash
cd /opt/qcobro
docker compose up -d
```

The apiserver container runs `prisma migrate deploy` automatically before
starting the server. On first boot, give it 20–30 seconds for the database
to initialize.

### Verify

```bash
# All five containers should be Up
docker compose ps

# Health check through Envoy
curl https://your.actual.domain.com/health

# Tail logs
docker compose logs -f apiserver
```

---

## Certificate renewal

Renewal is automatic and happens on two independent paths — you don't need to do
anything after Step 4:

1. **certbot's systemd timer** runs `certbot renew` twice daily. The deploy-hook
   registered in Step 4 is persisted into the cert's renewal config, so on an
   actual renewal it copies the new cert into `config/certs/` and restarts Envoy.
2. **Every QCobro deploy** runs `scripts/deploy/tls.sh` (see the Deploy
   workflow), which renews if inside the window and is otherwise a no-op.

Verify the renewal path end-to-end without issuing a real cert:

```bash
sudo certbot renew --dry-run
```

Check time remaining at any point:

```bash
scripts/deploy/tls.sh        # prints "expires in N day(s)" and acts only if due
```

---

## Updating QCobro

```bash
cd /opt/qcobro
git pull

# Option A — pull new images from GHCR
docker pull ghcr.io/<org>/qcobro-apiserver:<new-tag>
docker pull ghcr.io/<org>/qcobro-webapp:<new-tag>
docker tag ghcr.io/<org>/qcobro-apiserver:<new-tag> qcobro-apiserver:latest
docker tag ghcr.io/<org>/qcobro-webapp:<new-tag>    qcobro-webapp:latest

# Option B — build on server
./scripts/docker-build.sh --tag latest

# Redeploy (migrations run automatically)
docker compose up -d
```

---

## Secrets checklist

| Secret                     | Where                                                                         |
| -------------------------- | ----------------------------------------------------------------------------- |
| `qcobro.json` secrets      | The file at `/opt/qcobro/config/qcobro.json` on the server (DB URL, API keys) |
| DigitalOcean API token     | `/etc/letsencrypt/digitalocean/credentials.ini` (mode 600)                    |
| `FONOSTER_REPO_TOKEN` (CI) | GitHub repo secret — PAT with `contents: read` on the fonoster repo           |

---

## Troubleshooting

| Symptom                                 | Check                                                                                                                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `curl: (35) SSL handshake failed`       | Are `config/certs/{fullchain,privkey}.pem` present and non-empty? Re-run `scripts/deploy/tls.sh`.                                                                                                                             |
| `Failed to load incomplete private key` | Envoy can't read the key. Almost always userns-remap: Envoy reads `config/certs/` (0644 copies), not `/etc/letsencrypt` directly. Re-run `scripts/deploy/tls.sh` and confirm `docker compose config` mounts `./config/certs`. |
| Envoy exits immediately                 | Run `docker compose logs envoy` — usually a YAML syntax error or missing cert file                                                                                                                                            |
| Apiserver restarts in a loop            | Migrations failing — check `docker compose logs apiserver` and verify `DATABASE_URL` in `config/qcobro.json`                                                                                                                  |
| `npm ci` fails during Docker build      | `.docker-deps/` tarballs missing — re-run `scripts/docker-build.sh`                                                                                                                                                           |
