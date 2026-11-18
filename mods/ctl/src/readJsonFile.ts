import { readFileSync } from "node:fs";

/**
 * Reads and parses a JSON input file (e.g. `portfolios:sync --file` / `--exits`). Throws an
 * `Error` whose message names the path as the user typed it, ready to print as is.
 */
export function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`Could not read/parse ${path}: ${err instanceof Error ? err.message : err}`);
  }
}
