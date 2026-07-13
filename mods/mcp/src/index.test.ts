import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CliError, main, parseConfigArgs, runConfig } from "./index.js";
import { DEFAULT_ENDPOINT } from "./env.js";

test("parseConfigArgs defaults url and reads flags", () => {
  const opts = parseConfigArgs([
    "--access-key-id",
    "ak_1",
    "--access-key-secret",
    "secret",
    "--workspace",
    "ws_1"
  ]);
  assert.equal(opts.url, DEFAULT_ENDPOINT);
  assert.equal(opts.accessKeyId, "ak_1");
  assert.equal(opts.accessKeySecret, "secret");
  assert.equal(opts.workspace, "ws_1");
  assert.equal(opts.help, false);
});

test("parseConfigArgs honors a custom --url", () => {
  const opts = parseConfigArgs(["--url", "http://localhost:3000"]);
  assert.equal(opts.url, "http://localhost:3000");
});

test("runConfig throws CliError naming every missing required flag", () => {
  assert.throws(
    () => runConfig({ url: DEFAULT_ENDPOINT, help: false }, {}, () => {}, "darwin"),
    (err: unknown) =>
      err instanceof CliError &&
      err.message.includes("--access-key-id") &&
      err.message.includes("--access-key-secret") &&
      err.message.includes("--workspace")
  );
});

// Redirect the write via win32's APPDATA (fully env-driven) rather than
// darwin's real os.homedir(), so these tests never touch the developer's
// actual home directory.
test("runConfig writes the Claude Desktop config and reports the path", () => {
  const dir = mkdtempSync(join(tmpdir(), "qcobro-mcp-appdata-"));
  const lines: string[] = [];

  runConfig(
    {
      url: DEFAULT_ENDPOINT,
      accessKeyId: "ak_1",
      accessKeySecret: "secret",
      workspace: "ws_1",
      help: false
    },
    { APPDATA: dir },
    (s) => lines.push(s),
    "win32"
  );

  const configPath = join(dir, "Claude", "claude_desktop_config.json");
  const written = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(written.mcpServers.qcobro.env.QCOBRO_ACCESS_KEY_ID, "ak_1");
  assert.match(
    lines.join(""),
    new RegExp(`Configured Claude Desktop.*${dir.replace(/[/\\]/g, "\\$&")}`)
  );
});

test("main --help prints usage and exits 0", async () => {
  const lines: string[] = [];
  const code = await main(["--help"], {}, (s) => lines.push(s));
  assert.equal(code, 0);
  assert.match(lines.join(""), /Usage: qcobro-mcp/);
});

test("main config with missing flags exits 2 and prints usage to stderr", async () => {
  const errLines: string[] = [];
  const code = await main(
    ["config"],
    {},
    () => {},
    (s) => errLines.push(s)
  );
  assert.equal(code, 2);
  assert.match(errLines.join(""), /Missing required flag/);
  assert.match(errLines.join(""), /Usage: qcobro-mcp/);
});

test("main config --help prints usage and exits 0 without writing anything", async () => {
  const lines: string[] = [];
  const code = await main(["config", "--help"], {}, (s) => lines.push(s));
  assert.equal(code, 0);
  assert.match(lines.join(""), /Usage: qcobro-mcp/);
});

test("main rejects an unknown command", async () => {
  const errLines: string[] = [];
  const code = await main(
    ["frobnicate"],
    {},
    () => {},
    (s) => errLines.push(s)
  );
  assert.equal(code, 2);
  assert.match(errLines.join(""), /Unknown command: frobnicate/);
});
