import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, ValidationError } from "./index.js";

// Client-side validation must reject invalid input before any WebSocket connection is
// ever attempted — the generator throws on its first iteration, prior to calling
// `.subscribe(...)`. Constructing the client with an unreachable endpoint and never
// awaiting a connection proves no network attempt happens for these cases.

function unconnectedClient() {
  return new Client({ endpoint: "http://localhost:1" })
    .setTokens({ accessToken: "test-token" })
    .useWorkspace("ws_test");
}

async function firstEvent(gen: AsyncGenerator<unknown>) {
  const { value, done } = await gen.next();
  return { value, done };
}

test("evaluate rejects an input with neither agentTemplateId nor yaml", async () => {
  const client = unconnectedClient();
  await assert.rejects(
    () => firstEvent(client.agentEvaluations.evaluate({} as never)),
    ValidationError
  );
});

test("evaluate rejects agentTemplateId without scenarios", async () => {
  const client = unconnectedClient();
  await assert.rejects(
    () => firstEvent(client.agentEvaluations.evaluate({ agentTemplateId: "at_1" } as never)),
    ValidationError
  );
});

test("evaluate rejects an empty yaml string", async () => {
  const client = unconnectedClient();
  await assert.rejects(
    () => firstEvent(client.agentEvaluations.evaluate({ yaml: "" })),
    ValidationError
  );
});
