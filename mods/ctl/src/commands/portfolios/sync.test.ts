import { test, beforeEach, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Config } from "@oclif/core";
import Sync from "./sync.js";

// Drives the real command class with a loaded oclif Config, swapping only the SDK client
// (no network) and capturing what the command logs.

interface CommandSeams {
  createSdkClient: () => Promise<unknown>;
  log: (message?: string) => void;
}

const seams = Sync.prototype as unknown as CommandSeams;
const original = { createSdkClient: seams.createSdkClient, log: seams.log };

let config: Config;
let calls: unknown[];
let lines: string[];
let syncResult: Record<string, unknown>;
let dir: string;

const quietResult = {
  created: 3,
  updated: 412,
  archived: 21,
  total: 415,
  exitsByReason: {
    CAUGHT_UP: 0,
    PAID_OFF: 0,
    WRITTEN_OFF: 0,
    OTHER: 0,
    UNKNOWN: 0,
    classified: 0,
    skipped: 0
  },
  recoveries: { partial: 0, caughtUp: 0, paidOff: 0, amount: 0 }
};

before(async () => {
  config = await Config.load({ root: fileURLToPath(new URL("../../..", import.meta.url)) });
});

beforeEach(() => {
  calls = [];
  lines = [];
  syncResult = quietResult;
  dir = mkdtempSync(join(tmpdir(), "qcobro-sync-"));
  seams.createSdkClient = async () => ({
    portfolios: {
      syncAccounts: async (input: unknown) => {
        calls.push(input);
        return syncResult;
      }
    }
  });
  seams.log = (message?: string) => {
    lines.push(message ?? "");
  };
});

afterEach(() => {
  seams.createSdkClient = original.createSdkClient;
  seams.log = original.log;
  // oclif's Command.catch sets the process exit code for a failed command.
  process.exitCode = undefined;
});

function writeJson(name: string, value: unknown): string {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(value));
  return path;
}

const exits = [
  { externalId: "C-0877", reason: "CAUGHT_UP", missedInstallments: 2, termsAmount: 1500 },
  { externalId: "C-0878", reason: "WRITTEN_OFF" }
];

test("an exits-only sync without --file sends rows: [] and prints the non-zero lines", async () => {
  // Arrange
  const exitsFile = writeJson("exits.json", exits);
  syncResult = {
    created: 0,
    updated: 0,
    archived: 2,
    total: 413,
    exitsByReason: { ...quietResult.exitsByReason, CAUGHT_UP: 1, WRITTEN_OFF: 1 },
    recoveries: { partial: 0, caughtUp: 1, paidOff: 0, amount: 3000 }
  };

  // Act
  await Sync.run(
    ["--portfolio-id", "p1", "--exits", exitsFile, "--mode", "UPDATE_EXISTING"],
    config
  );

  // Assert
  assert.deepEqual(calls, [{ portfolioId: "p1", mode: "UPDATE_EXISTING", rows: [], exits }]);
  assert.deepEqual(lines, [
    "Synced: 0 created, 0 updated, 2 archived (total 413).",
    "Recovered: 0 partial, 1 caught up, 0 paid off (amount 3000).",
    "Exits: 1 caught up, 0 paid off, 1 written off, 0 other, 0 unknown."
  ]);
});

test("the Exits line adds classified and skipped when either is non-zero", async () => {
  // Arrange
  const exitsFile = writeJson("exits.json", exits);
  syncResult = {
    ...quietResult,
    exitsByReason: { ...quietResult.exitsByReason, classified: 2 }
  };

  // Act
  await Sync.run(["--portfolio-id", "p1", "--exits", exitsFile], config);

  // Assert
  assert.equal(
    lines[1],
    "Exits: 0 caught up, 0 paid off, 0 written off, 0 other, 0 unknown, 2 classified, 0 skipped."
  );
  assert.equal(lines.length, 2);
});

test("a --file-only sync that detects nothing prints only the Synced line", async () => {
  // Arrange
  const rowsFile = writeJson("rows.json", [
    { externalId: "C-1042", fullName: "Ana Pérez", outstandingBalance: 7500 }
  ]);

  // Act
  await Sync.run(["--portfolio-id", "p1", "--file", rowsFile, "--mode", "REPLACE"], config);

  // Assert
  assert.deepEqual(lines, ["Synced: 3 created, 412 updated, 21 archived (total 415)."]);
  assert.equal(calls.length, 1);
});

test("REPLACE without --file fails before calling the API", async () => {
  // Arrange
  const exitsFile = writeJson("exits.json", exits);

  // Act + Assert
  await assert.rejects(
    () => Sync.run(["--portfolio-id", "p1", "--exits", exitsFile, "--mode", "REPLACE"], config),
    (err: Error & { oclif?: { exit?: number } }) => {
      assert.equal(
        err.message,
        "--file is required in REPLACE mode (an empty batch would archive every account)"
      );
      assert.equal(err.oclif?.exit, 1);
      return true;
    }
  );
  assert.equal(calls.length, 0);
});

test("neither --file nor --exits fails before calling the API", async () => {
  await assert.rejects(
    () => Sync.run(["--portfolio-id", "p1"], config),
    (err: Error & { oclif?: { exit?: number } }) => {
      assert.equal(err.message, "pass --file, --exits or both");
      assert.equal(err.oclif?.exit, 1);
      return true;
    }
  );
  assert.equal(calls.length, 0);
});

test("an unreadable exits file fails with the read error before calling the API", async () => {
  // Arrange
  const exitsFile = join(dir, "exits.json");
  writeFileSync(exitsFile, "{ not json");

  // Act + Assert
  await assert.rejects(
    () =>
      Sync.run(["--portfolio-id", "p1", "--exits", exitsFile, "--mode", "UPDATE_EXISTING"], config),
    (err: Error & { oclif?: { exit?: number } }) => {
      assert.ok(err.message.startsWith(`Could not read/parse ${exitsFile}: `), err.message);
      assert.equal(err.oclif?.exit, 1);
      return true;
    }
  );
  assert.equal(calls.length, 0);
});
