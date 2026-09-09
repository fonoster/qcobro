import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

/**
 * Resolves a user-supplied input path (e.g. `agents:eval --file` / `--scenarios`) and
 * asserts the file exists before anything tries to read it.
 *
 * - An absolute path is checked as given.
 * - A relative path is resolved against `cwd` (i.e. treated as `./<path>`) first, so
 *   `evals/x.yaml` and `./evals/x.yaml` behave identically.
 *
 * Throws an `Error` whose message names the path the user typed — and, for a relative
 * path, the absolute path it resolved to — so a typo fails loudly instead of surfacing
 * as a bare `ENOENT` (or, on a streaming command, as no output at all).
 */
export function resolveInputFile(input: string, cwd: string = process.cwd()): string {
  const absolute = isAbsolute(input) ? input : resolve(cwd, input);
  if (!existsSync(absolute)) {
    throw new Error(
      isAbsolute(input)
        ? `File not found: ${input}`
        : `File not found: ${input} (resolved to ${absolute})`
    );
  }
  return absolute;
}
