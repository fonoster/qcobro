import { test } from "node:test";
import assert from "node:assert/strict";
import { readServerEnv, EnvError, DEFAULT_ENDPOINT } from "./env.js";

const VALID_ENV = {
  QCOBRO_ACCESS_KEY_ID: "ak_1",
  QCOBRO_ACCESS_KEY_SECRET: "secret",
  QCOBRO_WORKSPACE: "ws_1"
};

test("reads all required variables and defaults the endpoint", () => {
  const env = readServerEnv(VALID_ENV);
  assert.equal(env.accessKeyId, "ak_1");
  assert.equal(env.accessKeySecret, "secret");
  assert.equal(env.workspace, "ws_1");
  assert.equal(env.endpoint, DEFAULT_ENDPOINT);
});

test("honors a custom QCOBRO_ENDPOINT", () => {
  const env = readServerEnv({ ...VALID_ENV, QCOBRO_ENDPOINT: "http://localhost:3000" });
  assert.equal(env.endpoint, "http://localhost:3000");
});

for (const missing of [
  "QCOBRO_ACCESS_KEY_ID",
  "QCOBRO_ACCESS_KEY_SECRET",
  "QCOBRO_WORKSPACE"
] as const) {
  test(`throws EnvError naming the missing variable: ${missing}`, () => {
    const env = { ...VALID_ENV, [missing]: undefined };
    assert.throws(
      () => readServerEnv(env),
      (err: unknown) => err instanceof EnvError && err.message.includes(missing)
    );
  });
}
