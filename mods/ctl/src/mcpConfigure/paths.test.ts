import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import { claudeDesktopConfigPath } from "./paths.js";

test("resolves the macOS path under the user's home directory", () => {
  const path = claudeDesktopConfigPath("darwin", {});
  assert.equal(
    path,
    join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json")
  );
});

test("resolves the Windows path using APPDATA when set", () => {
  const path = claudeDesktopConfigPath("win32", { APPDATA: "C:\\Users\\pedro\\AppData\\Roaming" });
  assert.equal(
    path,
    join("C:\\Users\\pedro\\AppData\\Roaming", "Claude", "claude_desktop_config.json")
  );
});

test("falls back to a default Windows path when APPDATA is unset", () => {
  const path = claudeDesktopConfigPath("win32", {});
  assert.equal(path, join(homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json"));
});

test("throws for an unsupported platform", () => {
  assert.throws(() => claudeDesktopConfigPath("linux", {}), /Unsupported platform/);
});
