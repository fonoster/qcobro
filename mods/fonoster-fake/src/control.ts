import { createServer, type IncomingMessage, type Server } from "node:http";
import { z } from "zod";
import { FakeError, OUTCOMES, type FonosterFake } from "./fake.js";

const DEFAULT_DURATION_SECONDS = 30;

const scriptSchema = z
  .object({
    to: z.string({ message: "to is required" }).min(1, { message: "to is required" }),
    outcome: z.enum(OUTCOMES, { message: `outcome must be one of ${OUTCOMES.join(", ")}` }),
    durationSeconds: z
      .number({ message: "durationSeconds must be a whole number of seconds" })
      .int({ message: "durationSeconds must be a whole number of seconds" })
      .nonnegative({ message: "durationSeconds must be a whole number of seconds" })
      .optional(),
    transcript: z
      .array(
        z.object({
          role: z.enum(["agent", "caller"], { message: "role must be agent or caller" }),
          text: z.string({ message: "text is required" })
        }),
        { message: "transcript must be a list of turns" }
      )
      .optional()
  })
  .superRefine((value, ctx) => {
    if (value.outcome === "answered") return;
    for (const field of ["durationSeconds", "transcript"] as const) {
      if (value[field] !== undefined)
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${field} applies to an answered call only`
        });
    }
  });

const completeSchema = z.object({
  order: z.array(z.string(), { message: "order must be a list of event types" }).optional()
});

const redeliverSchema = z.object({
  eventId: z.string({ message: "eventId is required" }).min(1, { message: "eventId is required" })
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new FakeError(400, "invalid_request", issue.message, issue.path.join(".") || undefined);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new FakeError(400, "invalid_request", "The body is not valid JSON");
  }
}

/** The control API (`/_fake/*`), plain HTTP: script calls, hang them up, inspect what was sent. */
export function createControlServer(fake: FonosterFake): Server {
  const route = async (req: IncomingMessage): Promise<[number, unknown]> => {
    const url = new URL(req.url ?? "/", "http://fonoster-fake");
    const path = url.pathname;
    const method = req.method ?? "GET";

    if (method === "GET" && path === "/_fake/health") return [200, { ok: true }];

    if (method === "GET" && path === "/_fake/applications")
      return [
        200,
        [...fake.applications.values()].map((app) => ({ ref: app.ref, ...app.request }))
      ];

    if (method === "GET" && path === "/_fake/calls") {
      const to = url.searchParams.get("to");
      const calls = [...fake.calls.values()].filter((c) => !to || c.to === to);
      return [200, calls.map((c) => fake.view(c))];
    }

    if (method === "POST" && path === "/_fake/calls/script") {
      const body = parse(scriptSchema, await readJson(req));
      const queued = fake.script(body.to, {
        outcome: body.outcome,
        durationSeconds: body.durationSeconds ?? DEFAULT_DURATION_SECONDS,
        transcript: body.transcript ?? []
      });
      return [200, { to: body.to, queued }];
    }

    const action = /^\/_fake\/calls\/([^/]+)\/(complete|redeliver)$/.exec(path);
    if (method === "POST" && action) {
      const ref = decodeURIComponent(action[1]);
      if (action[2] === "complete") {
        const body = parse(completeSchema, await readJson(req));
        const call = await fake.complete(ref, body.order);
        return [200, { ref: call.ref, state: call.state, deliveries: call.deliveries }];
      }
      const body = parse(redeliverSchema, await readJson(req));
      return [200, await fake.redeliver(ref, body.eventId)];
    }

    throw new FakeError(404, "not_found", `No route for ${method} ${path}`);
  };

  return createServer((req, res) => {
    route(req)
      .catch((err): [number, unknown] => {
        if (err instanceof FakeError)
          return [
            err.status,
            {
              error: {
                code: err.code,
                message: err.message,
                ...(err.param ? { param: err.param } : {})
              }
            }
          ];
        return [500, { error: { code: "internal", message: String(err) } }];
      })
      .then(([status, body]) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      });
  });
}
