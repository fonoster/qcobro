import { createServer, type Server } from "node:https";
import type { FonosterFake } from "./fake.js";
import type { Tokens } from "./tokens.js";

/**
 * The records HTTP API (`GET /api/records/:callRef` and `…/recording`) over TLS, as
 * `CallRecords` in `@fonoster/sdk` 0.63.0 reads it. Only version 1 exists; there are no
 * recordings.
 */
export function createRecordsServer(
  fake: FonosterFake,
  tokens: Tokens,
  tls: { cert: Buffer; key: Buffer }
): Server {
  return createServer({ cert: tls.cert, key: tls.key }, (req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url ?? "/", "https://fonoster-fake");
    const match = /^\/api\/records\/([^/]+)(\/recording)?$/.exec(url.pathname);
    if (req.method !== "GET" || !match) return send(404, { error: "not_found" });

    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    const accessKeyId = req.headers["x-accesskey-id"];
    if (!tokens.verify(bearer, "access") || accessKeyId !== fake.config.accessKeyId)
      return send(401, { error: "unauthenticated", message: "invalid or expired access token" });

    const record = fake.record(accessKeyId, decodeURIComponent(match[1]));
    if (!record) return send(404, { error: "not_found" });
    if (match[2]) return send(404, { error: "no_recording" });
    send(200, record);
  });
}
