import { test } from "node:test";
import assert from "node:assert/strict";
import { main } from "./index.js";

test("main --help prints usage and exits 0", async () => {
  const lines: string[] = [];
  const code = await main(["--help"], (s) => lines.push(s));
  assert.equal(code, 0);
  assert.match(lines.join(""), /Usage: qcobro-mcp/);
});

test("main --help points users at @qcobro/ctl for MCP-client configuration", async () => {
  const lines: string[] = [];
  await main(["--help"], (s) => lines.push(s));
  assert.match(lines.join(""), /@qcobro\/ctl mcp:configure/);
});

test("main rejects an unknown command", async () => {
  const errLines: string[] = [];
  const code = await main(
    ["frobnicate"],
    () => {},
    (s) => errLines.push(s)
  );
  assert.equal(code, 2);
  assert.match(errLines.join(""), /Unknown command: frobnicate/);
});
