# @qcobro/fonoster-fake

A stateful fake of the part of Fonoster that QCobro uses: Identity login, Voz IA (AUTOPILOT)
applications, outbound calls and their CDRs, call records, and the signed workspace webhooks
(`call.ended`, `call.failed`, `call_record.sealed`). It lets you run QCobro's voice integration end
to end without a Fonoster account and without dialing anyone.

**Development and tests only.** It is a private package: it is never published to npm, never built
by `docker-publish.yml`, and must never appear in a production `qcobro.json`. It models
`@fonoster/sdk` and `@fonoster/common` at the exact version the apiserver pins (0.63.0); a unit
test fails when the two drift apart.

## What it serves

One process, three ports:

| Port (env)                   | Protocol   | Serves                                                                                                                             |
| :--------------------------- | :--------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| `FONOSTER_FAKE_GRPC_PORT`    | gRPC (TLS) | `Identity.exchangeApiKey` / `exchangeRefreshToken`, `Applications.create/update/deleteApplication`, `Calls.createCall` / `getCall` |
| `FONOSTER_FAKE_HTTPS_PORT`   | HTTPS      | `GET /api/records/:callRef` and `GET /api/records/:callRef/recording` (`Authorization: Bearer <accessToken>`, `x-accesskey-id`)    |
| `FONOSTER_FAKE_CONTROL_PORT` | HTTP       | The control API under `/_fake/*` (below)                                                                                           |

Every other RPC answers `UNIMPLEMENTED`, including `Calls.trackCall` (the SDK opens it after
`createCall`; QCobro never reads it, and production never fires it either).

Behavior worth knowing:

- `createCall` validates, in this order: `from` E.164, `to` E.164 or SIP URI, `appRef` a UUID,
  `timeout` at most 120 (default 30), else `INVALID_ARGUMENT`; then `appRef` must be an app of this
  access key, else `NOT_FOUND`; then `from` must be one of `FONOSTER_FAKE_NUMBERS`, else
  `PERMISSION_DENIED`.
- An AUTOPILOT app whose language model (`intelligence.config.languageModel.model`,
  `<provider>/<model>`) is not in `FONOSTER_FAKE_LLM_MODELS` is refused with `INVALID_ARGUMENT`.
- `getCall` answers `NOT_FOUND` until the call's `call_record.sealed` was posted, then the CDR
  (`NORMAL_CLEARING` answered, `USER_BUSY` busy, `NO_ANSWER` no answer, `CALL_REJECTED` rejected).
- The record is served from the moment the call is completed, before `call_record.sealed` is
  posted. The customer is party 0 (`caller`), the agent party 2 (`agent`). A failed call's record
  has no text turns.

## Environment

Every variable but `FONOSTER_FAKE_AUTO_COMPLETE_MS` is required; the process exits at boot naming
the first one missing.

| Variable                         | Example                                  | Meaning                                                                                               |
| :------------------------------- | :--------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| `FONOSTER_FAKE_GRPC_PORT`        | `50052`                                  | gRPC port. Not 50051 (Identity) nor 50061 (`apiserver.voicePort`).                                    |
| `FONOSTER_FAKE_HTTPS_PORT`       | `443`                                    | Records API port. Must be 443: the SDK builds `https://<endpoint host>` with no port.                 |
| `FONOSTER_FAKE_CONTROL_PORT`     | `8080`                                   | Control API port (plain HTTP).                                                                        |
| `FONOSTER_FAKE_TLS_CERT`         | `/certs/server.pem`                      | Server certificate (PEM), used by both gRPC and HTTPS.                                                |
| `FONOSTER_FAKE_TLS_KEY`          | `/certs/server-key.pem`                  | Its private key (PEM).                                                                                |
| `FONOSTER_FAKE_ACCESS_KEY_ID`    | `WO00000000000000000000000000000001`     | The workspace (`fonoster.accessKeyId`); also the webhooks' `workspaceRef`.                            |
| `FONOSTER_FAKE_API_KEY`          | `AP00000000000000000000000000000001`     | The API key (`fonoster.apiKey`).                                                                      |
| `FONOSTER_FAKE_API_SECRET`       | `<generated>`                            | The API secret (`fonoster.apiSecret`). Any other credentials get `UNAUTHENTICATED`.                   |
| `FONOSTER_FAKE_NUMBERS`          | `+18095550000`                           | Comma-separated numbers the workspace owns; `createCall`'s `from` must be one of them.                |
| `FONOSTER_FAKE_WEBHOOK_URL`      | `http://workspace:3000/api/voice/events` | Where the webhooks are posted.                                                                        |
| `FONOSTER_FAKE_WEBHOOK_SECRET`   | `<generated>`                            | Signing secret. Must equal `fonoster.webhookSecret` in `qcobro.json`.                                 |
| `FONOSTER_FAKE_AUTO_COMPLETE_MS` | unset                                    | Unset: a call completes only on `/complete`. Set: every call completes on its own after that many ms. |
| `FONOSTER_FAKE_LLM_MODELS`       | `google/gemini-3.1-flash-lite`           | Comma-separated language model catalog ids (`<provider>/<model>`).                                    |

QCobro reaches the fake with `fonoster.endpoint: "fonoster-fake:50052"` in `qcobro.json`.

## TLS

The SDK always talks TLS. Make a CA, a server certificate whose SAN covers the host names the
fake is reached by (`fonoster-fake` and `localhost`), and point the apiserver at the CA through
the SDK's own `FONOSTER_CA_FILE` environment variable:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=fonoster-fake CA" \
  -keyout ca-key.pem -out ca.pem
openssl req -newkey rsa:2048 -nodes -subj "/CN=fonoster-fake" \
  -keyout server-key.pem -out server.csr
printf 'subjectAltName=DNS:fonoster-fake,DNS:localhost\n' > san.ext
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca-key.pem -CAcreateserial -days 365 \
  -extfile san.ext -out server.pem

# The apiserver (and any SDK client) trusts the fake through:
export FONOSTER_CA_FILE=$PWD/ca.pem
```

## Webhooks

Completing a call posts its events to `FONOSTER_FAKE_WEBHOOK_URL`, one after another, with no
retries. They are built with `@fonoster/common`'s `Webhooks` helpers, so the envelope
(`id`, `type`, `createdAt`, `workspaceRef`, `data`) is Fonoster's. Each request carries:

- `content-type: application/json`
- `x-fonoster-timestamp: <unix seconds>`
- `x-fonoster-signature: hex(HMAC-SHA256(FONOSTER_FAKE_WEBHOOK_SECRET, "<timestamp>." + body))`,
  over the exact bytes sent

QCobro's `/api/voice/events` accepts them only when the secret equals `fonoster.webhookSecret`.
An answered call sends `call.ended` then `call_record.sealed`; a busy, unanswered or rejected one
sends `call.failed` (`reason`: `busy`, `no_answer` or `rejected`) then `call_record.sealed`. A
delivery `status` of 200 proves the signature was accepted, not that QCobro matched a gestión
(the receiver answers 200 for unknown call refs).

## Control API

Plain HTTP on the control port. Errors are
`{"error":{"code":"invalid_request|not_found|conflict","message":"…","param":"…"}}`.

**Script the next call to a number.** Scripts queue first in, first out per `to`. An unscripted
call answers, lasts 30 s and has a transcript without a payment promise. `durationSeconds`
(default 30) and `transcript` apply to `answered` only.

```bash
curl -s -X POST localhost:8080/_fake/calls/script -H 'content-type: application/json' -d '{
  "to": "+18095550101", "outcome": "answered", "durationSeconds": 42,
  "transcript": [ {"role":"agent","text":"Hola, le habla Clara."},
                  {"role":"caller","text":"Le pago mañana la cuota."} ] }'
# → {"to":"+18095550101","queued":1}
```

**Complete (hang up) a call.** Posts its events and answers after the last one. `order` may
reorder or omit events valid for the call's outcome. A second complete is a `409 conflict`.

```bash
curl -s -X POST localhost:8080/_fake/calls/<ref>/complete
curl -s -X POST localhost:8080/_fake/calls/<ref>/complete -H 'content-type: application/json' \
  -d '{"order":["call_record.sealed","call.ended"]}'
# → {"ref":"…","state":"completed","deliveries":[{"eventId":"evt_…","type":"call.ended","status":200,"deliveredAt":"…"}, …]}
```

**Redeliver an event.** Same id and body bytes, fresh timestamp and signature.

```bash
curl -s -X POST localhost:8080/_fake/calls/<ref>/redeliver -H 'content-type: application/json' \
  -d '{"eventId":"evt_…"}'
```

**List calls** (optionally by `to`), **applications**, and check **health**:

```bash
curl -s 'localhost:8080/_fake/calls?to=%2B18095550101'
curl -s localhost:8080/_fake/applications
curl -s localhost:8080/_fake/health
```

## Running it

```bash
npm run build --workspace=mods/fonoster-fake
FONOSTER_FAKE_GRPC_PORT=50052 FONOSTER_FAKE_HTTPS_PORT=443 … npx qcobro-fonoster-fake

# Or as a container (built from the repository root; it runs as `node` and may bind 443):
docker build -f mods/fonoster-fake/Dockerfile -t qcobro/fonoster-fake .
```

In tests, start it in-process on free ports with `startFonosterFake(loadConfig({...}))` (ports `0`);
see `src/fonosterFake.test.ts`.

## What it doesn't do

- **Recordings:** `GET /api/records/:callRef/recording` always answers `404 {"error":"no_recording"}`.
- **Agent evaluations:** `Applications.evaluateIntelligence` answers `UNIMPLEMENTED`.
- **Later record versions:** only version 1 of a record exists.
- Webhook retries, the pre-recorded voice session, and any provider other than Fonoster.
