import { randomUUID } from "node:crypto";
import { callEnded, callFailed, callRecordSealed } from "@fonoster/common/dist/webhooks/events.js";
import { webhookHeaders } from "@fonoster/common/dist/webhooks/signing.js";
import type { FonosterFakeConfig } from "./config.js";

export const OUTCOMES = ["answered", "busy", "no_answer", "rejected"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type EventType = "call.ended" | "call.failed" | "call_record.sealed";

export type Turn = { role: "agent" | "caller"; text: string };

export type Script = { outcome: Outcome; durationSeconds: number; transcript: Turn[] };

export type Application = {
  ref: string;
  accessKeyId: string;
  /** The last create or update request, as JSON (enums by name, Structs as plain objects). */
  request: Record<string, unknown>;
};

export type Delivery = {
  eventId: string;
  type: EventType;
  /** The receiver's HTTP status; 0 when the request itself failed (see `error`). */
  status: number;
  deliveredAt: string;
  error?: string;
};

export type Call = {
  ref: string;
  accessKeyId: string;
  from: string;
  to: string;
  appRef: string;
  timeout: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  outcome: Outcome;
  durationSeconds: number;
  transcript: Turn[];
  state: "in_progress" | "completing" | "completed";
  /** When the call cleared; set when completion starts. */
  endedAt?: Date;
  /** True once `call_record.sealed` was posted: from then on `getCall` returns the CDR. */
  sealed: boolean;
  /** Every event built for the call, by id, with the exact body bytes first sent. */
  events: Map<string, { type: EventType; body: string }>;
  deliveries: Delivery[];
};

/** A control API failure, in the shape `{ error: { code, message, param } }`. */
export class FakeError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly code: "invalid_request" | "not_found" | "conflict",
    message: string,
    readonly param?: string
  ) {
    super(message);
  }
}

/** What an unscripted call does: answered, 30 s, and no payment promise in the transcript. */
const UNSCRIPTED: Script = {
  outcome: "answered",
  durationSeconds: 30,
  transcript: [
    { role: "agent", text: "Hola, le habla Clara. ¿Tiene un momento para hablar de su cuota?" },
    { role: "caller", text: "Ahora no puedo hablar, llámeme luego." }
  ]
};

const DELIVERY_TIMEOUT_MS = 10_000;

/** The events valid for an outcome, in the order they are sent by default. */
export function defaultOrder(outcome: Outcome): EventType[] {
  return outcome === "answered"
    ? ["call.ended", "call_record.sealed"]
    : ["call.failed", "call_record.sealed"];
}

/**
 * The fake's state: applications, calls, call scripts, and webhook deliveries. In memory, for one
 * workspace (the configured access key). The gRPC, records and control servers all read and
 * change this one object.
 */
export class FonosterFake {
  readonly applications = new Map<string, Application>();
  readonly calls = new Map<string, Call>();
  private readonly scripts = new Map<string, Script[]>();
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(readonly config: FonosterFakeConfig) {}

  /** Queues a script for the next call to `to`; returns how many are queued for it. */
  script(to: string, script: Script): number {
    const queue = this.scripts.get(to) ?? [];
    queue.push(script);
    this.scripts.set(to, queue);
    return queue.length;
  }

  createApplication(accessKeyId: string, request: Record<string, unknown>): Application {
    const app = { ref: randomUUID(), accessKeyId, request };
    this.applications.set(app.ref, app);
    return app;
  }

  application(accessKeyId: string, ref: string): Application | undefined {
    const app = this.applications.get(ref);
    return app?.accessKeyId === accessKeyId ? app : undefined;
  }

  createCall(input: {
    accessKeyId: string;
    from: string;
    to: string;
    appRef: string;
    timeout: number;
    metadata: Record<string, unknown>;
  }): Call {
    const script = this.scripts.get(input.to)?.shift() ?? UNSCRIPTED;
    const call: Call = {
      ...input,
      ref: randomUUID(),
      createdAt: new Date(),
      outcome: script.outcome,
      durationSeconds: script.outcome === "answered" ? script.durationSeconds : 0,
      transcript: script.outcome === "answered" ? script.transcript : [],
      state: "in_progress",
      sealed: false,
      events: new Map(),
      deliveries: []
    };
    this.calls.set(call.ref, call);
    if (this.config.autoCompleteMs !== undefined) {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        this.complete(call.ref).catch(() => undefined);
      }, this.config.autoCompleteMs);
      timer.unref();
      this.timers.add(timer);
    }
    return call;
  }

  call(ref: string): Call {
    const call = this.calls.get(ref);
    if (!call) throw new FakeError(404, "not_found", `No such call: ${ref}`, "ref");
    return call;
  }

  /**
   * Hangs a call up: builds its events and posts them one after another, in `order` (default:
   * the outcome's). The record is served from the start; `getCall` finds the CDR once
   * `call_record.sealed` was posted.
   */
  async complete(ref: string, order?: string[]): Promise<Call> {
    const call = this.call(ref);
    if (call.state !== "in_progress")
      throw new FakeError(409, "conflict", `Call ${ref} was already completed`, "ref");
    const valid = defaultOrder(call.outcome);
    const types = (order ?? valid) as EventType[];
    const invalid = types.find((t) => !valid.includes(t));
    if (invalid)
      throw new FakeError(
        400,
        "invalid_request",
        `${invalid} is not an event of a ${call.outcome} call`,
        "order"
      );
    if (new Set(types).size !== types.length)
      throw new FakeError(400, "invalid_request", "order lists an event twice", "order");

    call.state = "completing";
    call.endedAt = new Date();
    for (const type of types) {
      const event = this.event(call, type);
      const body = JSON.stringify(event);
      call.events.set(event.id, { type, body });
      await this.deliver(call, event.id);
      if (type === "call_record.sealed") call.sealed = true;
    }
    call.state = "completed";
    return call;
  }

  /** Posts an event again: same id and body bytes, fresh timestamp and signature. */
  async redeliver(ref: string, eventId: string): Promise<Delivery> {
    const call = this.call(ref);
    if (!call.events.has(eventId))
      throw new FakeError(404, "not_found", `No such event: ${eventId}`, "eventId");
    return this.deliver(call, eventId);
  }

  private event(call: Call, type: EventType) {
    const workspaceRef = call.accessKeyId;
    const parties = {
      callRef: call.ref,
      appRef: call.appRef,
      from: call.from,
      to: call.to,
      direction: "outbound" as const
    };
    if (type === "call.ended")
      return callEnded(workspaceRef, {
        ...parties,
        durationSeconds: call.durationSeconds,
        endReason: "hangup"
      });
    if (type === "call.failed")
      return callFailed(workspaceRef, { ...parties, reason: call.outcome });
    return callRecordSealed(workspaceRef, {
      callRef: call.ref,
      version: 1,
      recordUrl: `/api/records/${call.ref}?version=1`
    });
  }

  private async deliver(call: Call, eventId: string): Promise<Delivery> {
    const { type, body } = call.events.get(eventId)!;
    const signed = webhookHeaders(body, [this.config.webhookSecret]);
    let status = 0;
    let error: string | undefined;
    try {
      const res = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-fonoster-timestamp": signed["X-Fonoster-Timestamp"],
          "x-fonoster-signature": signed["X-Fonoster-Signature"]
        },
        body,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS)
      });
      status = res.status;
      await res.arrayBuffer().catch(() => undefined);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const delivery: Delivery = {
      eventId,
      type,
      status,
      deliveredAt: new Date().toISOString(),
      ...(error ? { error } : {})
    };
    call.deliveries.push(delivery);
    return delivery;
  }

  /** The call's record (version 1, redacted), or undefined while the call is in progress. */
  record(accessKeyId: string, ref: string) {
    const call = this.calls.get(ref);
    if (!call || call.accessKeyId !== accessKeyId || call.state === "in_progress") return undefined;
    const ended = call.endedAt ?? new Date();
    const started = new Date(ended.getTime() - call.durationSeconds * 1000);
    const step = call.transcript.length
      ? (call.durationSeconds * 1000) / call.transcript.length
      : 0;
    return {
      callRef: call.ref,
      version: 1,
      currentVersion: 1,
      redacted: true,
      vcon: {
        parties: [
          { tel: call.to, role: "caller" },
          { tel: call.from, role: "callee" },
          { name: call.appRef, role: "agent", meta: { appRef: call.appRef } }
        ],
        dialog: call.transcript.map((turn, i) => {
          const party = turn.role === "caller" ? 0 : 2;
          return {
            type: "text",
            originator: party,
            parties: [party],
            body: turn.text,
            start: new Date(started.getTime() + i * step).toISOString(),
            mimetype: "text/plain"
          };
        }),
        fonoster: {}
      }
    };
  }

  /** The call as the control API lists it. */
  view(call: Call) {
    return {
      ref: call.ref,
      from: call.from,
      to: call.to,
      appRef: call.appRef,
      metadata: call.metadata,
      createdAt: call.createdAt.toISOString(),
      outcome: call.outcome,
      durationSeconds: call.durationSeconds,
      state: call.state,
      deliveries: call.deliveries
    };
  }

  stop() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
  }
}
