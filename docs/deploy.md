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
cp qcobro.example.json qcobro.json
```

Edit `qcobro.json` and fill in all `CHANGE_ME` values. Key fields for
production:

```json
{
  "database": {
    "url": "postgresql://<user>:<password>@<do-managed-db-host>:25060/qcobro?schema=public&sslmode=require"
  },
  "identity": {
    "endpoint": "identity:50051",
    "httpBridgeUrl": "https://app.qcobro.com"
  },
  "apiserver": {
    "port": 3000
  }
}
```

The database URL comes from your DigitalOcean managed PostgreSQL cluster's
connection string (found under **Databases → your cluster → Connection details**).
Use the `sslmode=require` parameter — DO managed databases require SSL.

> `qcobro.json` is never committed — it's listed in `.gitignore`.

---

## Step 3 — Update the Envoy config with your domain

Replace the placeholder domain in `config/envoy.yaml`:

```bash
sed -i 's/app\.qcobro\.com/your.actual.domain.com/g' config/envoy.yaml
```

---

## Step 4 — Issue a TLS certificate

Envoy reads the cert files at startup from `/etc/letsencrypt/live/<domain>/`.
Issue the cert **before** starting the stack.

### Option A — DNS-01 challenge (recommended, no port 80 required)

```bash
sudo apt update && sudo apt install -y certbot python3-certbot-dns-digitalocean

# Create a DigitalOcean API token at: DigitalOcean → API → Personal access tokens
# (Domains write scope is sufficient)
sudo mkdir -p /etc/letsencrypt/digitalocean
sudo tee /etc/letsencrypt/digitalocean/credentials.ini > /dev/null << 'EOF'
dns_digitalocean_token = <YOUR_DO_API_TOKEN>
EOF
sudo chmod 600 /etc/letsencrypt/digitalocean/credentials.ini

sudo certbot certonly \
  --dns-digitalocean \
  --dns-digitalocean-credentials /etc/letsencrypt/digitalocean/credentials.ini \
  --dns-digitalocean-propagation-seconds 30 \
  -d your.actual.domain.com \
  --agree-tos -m ops@yourdomain.com --non-interactive
```

### Option B — HTTP-01 standalone (Envoy not yet running)

Since this is the initial setup, port 443 is free:

```bash
sudo apt update && sudo apt install -y certbot

sudo certbot certonly \
  --standalone \
  -d your.actual.domain.com \
  --agree-tos -m ops@yourdomain.com --non-interactive
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

Certbot renews automatically via a systemd timer. After renewal, Envoy must
be restarted to load the new cert files.

Create a deploy hook:

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/restart-envoy.sh > /dev/null << 'EOF'
#!/bin/sh
cd /opt/qcobro && docker compose restart envoy
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-envoy.sh
```

Test without actually renewing:

```bash
sudo certbot renew --dry-run
```

Confirm the hook fires and Envoy restarts at the end.

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

| Secret                     | Where                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| `qcobro.json` secrets      | The file at `/opt/qcobro/qcobro.json` on the server (DB URL, API keys) |
| DigitalOcean API token     | `/etc/letsencrypt/digitalocean/credentials.ini` (mode 600)             |
| `FONOSTER_REPO_TOKEN` (CI) | GitHub repo secret — PAT with `contents: read` on the fonoster repo    |

---

## Troubleshooting

| Symptom                            | Check                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `curl: (35) SSL handshake failed`  | Cert path in `config/envoy.yaml` — does `/etc/letsencrypt/live/<domain>/fullchain.pem` exist?         |
| Envoy exits immediately            | Run `docker compose logs envoy` — usually a YAML syntax error or missing cert file                    |
| Apiserver restarts in a loop       | Migrations failing — check `docker compose logs apiserver` and verify `DATABASE_URL` in `qcobro.json` |
| `npm ci` fails during Docker build | `.docker-deps/` tarballs missing — re-run `scripts/docker-build.sh`                                   |
