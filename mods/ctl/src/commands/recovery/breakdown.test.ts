import { test, beforeEach, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Config } from "@oclif/core";
import Breakdown from "./breakdown.js";

// Drives the real command class with a loaded oclif Config, swapping only the SDK client
// (no network) and capturing what the command logs.

interface CommandSeams {
  createSdkClient: () => Promise<unknown>;
  log: (message?: string) => void;
}

const seams = Breakdown.prototype as unknown as CommandSeams;
const original = { createSdkClient: seams.createSdkClient, log: seams.log };

let config: Config;
let output: string;
let breakdownResult: unknown;

before(async () => {
  config = await Config.load({ root: fileURLToPath(new URL("../../..", import.meta.url)) });
});

beforeEach(() => {
  output = "";
  seams.createSdkClient = async () => ({
    recovery: { breakdown: async () => breakdownResult }
  });
  seams.log = (message?: string) => {
    output += `${message ?? ""}\n`;
  };
});

afterEach(() => {
  seams.createSdkClient = original.createSdkClient;
  seams.log = original.log;
});

const period = ["--from", "2026-10-01", "--to", "2026-10-31"];

test("--by CHANNEL ends with a TOTAL row", async () => {
  // Arrange
  breakdownResult = {
    additive: true,
    rows: [
      { key: "VOICE_AI", name: null, amount: 30100, count: 18 },
      { key: "WHATSAPP", name: null, amount: 18100, count: 13 }
    ]
  };

  // Act
  await Breakdown.run(["--by", "CHANNEL", ...period], config);

  // Assert
  assert.match(output, /^TOTAL\s+48200\s+31\s*$/m);
  assert.doesNotMatch(output, /not additive/);
});

test("--by CAMPAIGN prints names and the non-additive line instead of a total", async () => {
  // Arrange
  breakdownResult = {
    additive: false,
    rows: [{ key: "cmp-1", name: "Mora 8-30", amount: 30100, count: 18 }]
  };

  // Act
  await Breakdown.run(["--by", "CAMPAIGN", ...period], config);

  // Assert
  assert.match(output, /^KEY\s+NAME\s+AMOUNT\s+COUNT/m);
  assert.match(output, /^cmp-1\s+Mora 8-30\s+30100\s+18/m);
  assert.doesNotMatch(output, /TOTAL/);
  assert.match(
    output,
    /^Amounts are not additive: each campaign active on an account is credited the full amount\.$/m
  );
});
