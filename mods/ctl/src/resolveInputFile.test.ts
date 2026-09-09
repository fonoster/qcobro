import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveInputFile } from "./resolveInputFile.js";

const dir = mkdtempSync(join(tmpdir(), "qcobro-ctl-"));
writeFileSync(join(dir, "eval.yaml"), "type: VOICE_AI\n");

test("resolves a relative path against the given cwd and returns the absolute path", () => {
  assert.equal(resolveInputFile("eval.yaml", dir), join(dir, "eval.yaml"));
  assert.equal(resolveInputFile("./eval.yaml", dir), join(dir, "eval.yaml"));
});

test("returns an existing absolute path unchanged", () => {
  const abs = join(dir, "eval.yaml");
  assert.equal(resolveInputFile(abs, "/some/other/cwd"), abs);
});

test("throws for a missing relative path, naming the input and the resolved path", () => {
  assert.throws(
    () => resolveInputFile("nope/missing.yaml", dir),
    (err: Error) => {
      assert.match(err.message, /^File not found: nope\/missing\.yaml \(resolved to /);
      assert.ok(err.message.includes(resolve(dir, "nope/missing.yaml")));
      return true;
    }
  );
});

test("throws for a missing absolute path without a 'resolved to' suffix", () => {
  const abs = join(dir, "definitely-missing.yaml");
  assert.throws(
    () => resolveInputFile(abs),
    (err: Error) => {
      assert.equal(err.message, `File not found: ${abs}`);
      return true;
    }
  );
});
