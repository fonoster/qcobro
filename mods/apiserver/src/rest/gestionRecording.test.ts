import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGestionRecordingHandler } from "./gestionRecording.js";

const WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]).buffer;

interface Gestion {
  id: string;
  workspaceRef: string;
  providerRef: string | null;
}

function makeHandler(gestiones: Gestion[], recordings: Record<string, ArrayBuffer>) {
  const recordingCalls: unknown[][] = [];
  const handler = createGestionRecordingHandler({
    authenticate: async (token, workspace) =>
      token === "good-token" && workspace ? { accessKeyId: workspace } : null,
    prisma: {
      accountContactLog: {
        findFirst: async ({ where }) => {
          const g = gestiones.find(
            (x) =>
              x.id === where.id && x.workspaceRef === where.portfolioAccount.portfolio.workspaceRef
          );
          return g ? { providerRef: g.providerRef } : null;
        }
      }
    },
    callRecords: {
      getRecording: async (...args: unknown[]) => {
        recordingCalls.push(args);
        const data = recordings[args[0] as string];
        if (!data) throw Object.assign(new Error("records API: 404 not_found"), { status: 404 });
        return { data, contentType: "audio/x-wav", contentHash: "sha512-x" };
      }
    }
  });
  return { handler, recordingCalls };
}

async function get(
  handler: ReturnType<typeof createGestionRecordingHandler>,
  id: string,
  headers: Record<string, string>
) {
  const state = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown
  };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    },
    send(body: unknown) {
      state.body = body;
      return res;
    }
  };
  await handler({ params: { id }, headers } as never, res as never);
  return state;
}

const AUTH = { authorization: "Bearer good-token", "x-workspace": "WO-A" };

describe("GET /api/gestiones/:id/recording", () => {
  it("streams the redacted recording of a gestión in the caller's workspace", async () => {
    const { handler, recordingCalls } = makeHandler(
      [{ id: "g1", workspaceRef: "WO-A", providerRef: "call-1" }],
      { "call-1": WAV }
    );

    const state = await get(handler, "g1", AUTH);

    assert.equal(state.statusCode, 200);
    assert.equal(state.headers["content-type"], "audio/wav");
    assert.deepEqual(new Uint8Array(state.body as Buffer), new Uint8Array(WAV));
    // Only the call ref: never `original: true`, never a client-supplied ref.
    assert.deepEqual(recordingCalls, [["call-1"]]);
  });

  it("answers 404 for a gestión in another workspace", async () => {
    const { handler, recordingCalls } = makeHandler(
      [{ id: "g1", workspaceRef: "WO-B", providerRef: "call-1" }],
      { "call-1": WAV }
    );

    const state = await get(handler, "g1", AUTH);

    assert.equal(state.statusCode, 404);
    assert.equal(recordingCalls.length, 0);
  });

  it("answers 404 for a gestión with no providerRef", async () => {
    const { handler } = makeHandler([{ id: "g1", workspaceRef: "WO-A", providerRef: null }], {});
    assert.equal((await get(handler, "g1", AUTH)).statusCode, 404);
  });

  it("answers 404 when the call record has no recording", async () => {
    const { handler } = makeHandler(
      [{ id: "g1", workspaceRef: "WO-A", providerRef: "call-1" }],
      {}
    );
    assert.equal((await get(handler, "g1", AUTH)).statusCode, 404);
  });

  it("answers 401 without a valid token", async () => {
    const { handler, recordingCalls } = makeHandler(
      [{ id: "g1", workspaceRef: "WO-A", providerRef: "call-1" }],
      { "call-1": WAV }
    );

    const state = await get(handler, "g1", { "x-workspace": "WO-A" });

    assert.equal(state.statusCode, 401);
    assert.equal(recordingCalls.length, 0);
  });
});
