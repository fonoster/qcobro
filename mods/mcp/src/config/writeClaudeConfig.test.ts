import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildQCobroEntry, mergeClaudeConfig, writeClaudeConfig } from "./writeClaudeConfig.js";

const ENTRY = buildQCobroEntry({
  endpoint: "https://api.qcobro.com",
  accessKeyId: "ak_1",
  accessKeySecret: "secret",
  workspace: "ws_1"
});

test("buildQCobroEntry shapes the mcpServers entry", () => {
  assert.deepEqual(ENTRY, {
    command: "npx",
    args: ["-y", "@qcobro/mcp@latest"],
    env: {
      QCOBRO_ENDPOINT: "https://api.qcobro.com",
      QCOBRO_ACCESS_KEY_ID: "ak_1",
      QCOBRO_ACCESS_KEY_SECRET: "secret",
      QCOBRO_WORKSPACE: "ws_1"
    }
  });
});

test("mergeClaudeConfig starts fresh when no existing config is given", () => {
  const { config, warning } = mergeClaudeConfig(undefined, ENTRY);
  assert.deepEqual(config, { mcpServers: { qcobro: ENTRY } });
  assert.equal(warning, undefined);
});

test("mergeClaudeConfig preserves other mcpServers entries", () => {
  const existing = JSON.stringify({
    mcpServers: { fonoster: { command: "npx", args: ["-y", "@fonoster/mcp"], env: {} } }
  });
  const { config, warning } = mergeClaudeConfig(existing, ENTRY);
  assert.equal(warning, undefined);
  assert.ok(config.mcpServers.fonoster);
  assert.deepEqual(config.mcpServers.qcobro, ENTRY);
});

test("mergeClaudeConfig replaces a pre-existing qcobro entry", () => {
  const existing = JSON.stringify({
    mcpServers: { qcobro: { command: "old", args: [], env: {} } }
  });
  const { config } = mergeClaudeConfig(existing, ENTRY);
  assert.deepEqual(config.mcpServers.qcobro, ENTRY);
});

test("mergeClaudeConfig falls back to an empty config on unparseable JSON, with a warning", () => {
  const { config, warning } = mergeClaudeConfig("{ not valid json", ENTRY);
  assert.deepEqual(config, { mcpServers: { qcobro: ENTRY } });
  assert.match(warning ?? "", /Could not parse/);
});

test("writeClaudeConfig creates the file and parent directory when none exists", () => {
  const dir = mkdtempSync(join(tmpdir(), "qcobro-mcp-"));
  const configPath = join(dir, "nested", "claude_desktop_config.json");

  const warning = writeClaudeConfig(configPath, ENTRY);

  assert.equal(warning, undefined);
  const written = JSON.parse(readFileSync(configPath, "utf8"));
  assert.deepEqual(written.mcpServers.qcobro, ENTRY);
});

test("writeClaudeConfig merges into an existing file, preserving other entries", () => {
  const dir = mkdtempSync(join(tmpdir(), "qcobro-mcp-"));
  const configPath = join(dir, "claude_desktop_config.json");
  writeFileSync(
    configPath,
    JSON.stringify({ mcpServers: { other: { command: "x", args: [], env: {} } } })
  );

  writeClaudeConfig(configPath, ENTRY);

  const written = JSON.parse(readFileSync(configPath, "utf8"));
  assert.ok(written.mcpServers.other);
  assert.deepEqual(written.mcpServers.qcobro, ENTRY);
});
