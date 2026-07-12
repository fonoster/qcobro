#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { evaluate } from "../evaluation/evaluate.js";
import {
  evaluationParametersSchema,
  type EvaluationParameters,
  type Scorecard
} from "../evaluation/scorecard.js";
import type { EngineEvent } from "../schemas/engineEvents.js";

/**
 * `engine-eval` — the npx-runnable judge client (engine-scorecard capability,
 * requirement "A deployment can be evaluated with npx"). Fetches the flight-
 * recorder stream + engine parameters from a deployment's
 * `GET /api/engine/events`, runs the pure `evaluate` from this same package
 * locally, and prints the resulting scorecard. No repository checkout,
 * database access, or config file is required — only the API URL and a
 * workspace API key pair. All imports below are relative (this file ships
 * inside `@qcobro/common`; it must not import its own package by name).
 */

export const DEFAULT_URL = "https://api.qcobro.com";

export interface CliOptions {
  url: string;
  from?: string;
  to?: string;
  accessKeyId?: string;
  accessKeySecret?: string;
  latencyP95?: number;
  maxErrorRate?: number;
  livenessTicks?: number;
  json: boolean;
  help: boolean;
}

export const USAGE = `Usage: engine-eval [options]

Evaluate a QCobro deployment's campaigns-engine event stream against the
built-in invariant catalog (safety, performance, liveness) and print a
scorecard. Exits non-zero when the overall verdict is fail.

Options:
  --url <url>                   Deployment API base URL (default: ${DEFAULT_URL})
  --from <iso>                  Range start (ISO datetime)
  --to <iso>                    Range end (ISO datetime)
                                 (omit both to evaluate today, operator's local timezone)
  --access-key-id <id>          Workspace API key id (or QCOBRO_ACCESS_KEY_ID)
  --access-key-secret <secret>  Workspace API key secret (or QCOBRO_ACCESS_KEY_SECRET)
  --latency-p95 <ms>            Override PERF-2 threshold (dispatch latency p95, ms)
  --max-error-rate <0..1>       Override PERF-3 threshold (max per-channel error rate)
  --liveness-ticks <n>          Override LIVE-1 threshold (ticks to first attempt)
  --json                        Print the scorecard as JSON instead of text
  --help                        Show this help

Exit codes: 0 = pass, 1 = fail, 2 = usage/network/auth error.
`;

/** Raised for usage, network, or auth failures — mapped to exit code 2. */
export class CliError extends Error {}

const OPTION_SPEC = {
  url: { type: "string" },
  from: { type: "string" },
  to: { type: "string" },
  "access-key-id": { type: "string" },
  "access-key-secret": { type: "string" },
  "latency-p95": { type: "string" },
  "max-error-rate": { type: "string" },
  "liveness-ticks": { type: "string" },
  json: { type: "boolean", default: false },
  help: { type: "boolean", default: false }
} as const;

function parseNumberFlag(flag: string, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new CliError(`--${flag} must be a number, got "${raw}"`);
  }
  return value;
}

/** Parses argv into typed options. Throws `CliError` on malformed flags. */
export function parseCliArgs(argv: string[]): CliOptions {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: OPTION_SPEC, allowPositionals: false }));
  } catch (err) {
    throw new CliError(`Invalid arguments: ${err instanceof Error ? err.message : String(err)}`);
  }
  return {
    url: values.url ?? DEFAULT_URL,
    from: values.from,
    to: values.to,
    accessKeyId: values["access-key-id"],
    accessKeySecret: values["access-key-secret"],
    latencyP95: parseNumberFlag("latency-p95", values["latency-p95"]),
    maxErrorRate: parseNumberFlag("max-error-rate", values["max-error-rate"]),
    livenessTicks: parseNumberFlag("liveness-ticks", values["liveness-ticks"]),
    json: values.json ?? false,
    help: values.help ?? false
  };
}

/**
 * Resolves the from/to range. When BOTH flags are omitted, defaults to today
 * in the operator's local timezone (the machine running the CLI): local
 * midnight through now. When either flag is given, both are passed through
 * unchanged (no default is applied to just one side).
 */
export function resolveRange(
  from: string | undefined,
  to: string | undefined,
  now: Date
): { from?: string; to?: string } {
  if (from === undefined && to === undefined) {
    const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { from: localMidnight.toISOString(), to: now.toISOString() };
  }
  return { from, to };
}

/** Resolves the API key pair from flags, falling back to environment variables. */
export function resolveCredentials(
  opts: Pick<CliOptions, "accessKeyId" | "accessKeySecret">,
  env: Record<string, string | undefined>
): { accessKeyId: string; accessKeySecret: string } {
  const accessKeyId = opts.accessKeyId ?? env.QCOBRO_ACCESS_KEY_ID;
  const accessKeySecret = opts.accessKeySecret ?? env.QCOBRO_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) {
    throw new CliError(
      "Missing API key credentials: pass --access-key-id/--access-key-secret or set " +
        "QCOBRO_ACCESS_KEY_ID/QCOBRO_ACCESS_KEY_SECRET"
    );
  }
  return { accessKeyId, accessKeySecret };
}

/** Builds only the threshold overrides the operator actually passed. */
export function buildThresholdOverrides(
  opts: Pick<CliOptions, "latencyP95" | "maxErrorRate" | "livenessTicks">
): Partial<EvaluationParameters["thresholds"]> {
  const thresholds: Partial<EvaluationParameters["thresholds"]> = {};
  if (opts.latencyP95 !== undefined) thresholds.dispatchLatencyP95Ms = opts.latencyP95;
  if (opts.maxErrorRate !== undefined) thresholds.maxErrorRate = opts.maxErrorRate;
  if (opts.livenessTicks !== undefined) thresholds.livenessTicks = opts.livenessTicks;
  return thresholds;
}

interface EventsResponse {
  events: EngineEvent[];
  /** Set when the server capped the response; narrow the range and re-run. */
  truncated?: boolean;
  parameters: {
    tickSeconds: number;
    ratesPerMinute: EvaluationParameters["ratesPerMinute"];
  };
}

async function fetchEvents(
  url: string,
  range: { from?: string; to?: string },
  accessKeyId: string,
  accessKeySecret: string
): Promise<EventsResponse> {
  let endpoint: URL;
  try {
    endpoint = new URL("/api/engine/events", url);
  } catch {
    throw new CliError(`Invalid --url "${url}"`);
  }
  if (range.from) endpoint.searchParams.set("from", range.from);
  if (range.to) endpoint.searchParams.set("to", range.to);

  const auth = Buffer.from(`${accessKeyId}:${accessKeySecret}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(endpoint, { headers: { Authorization: `Basic ${auth}` } });
  } catch (err) {
    throw new CliError(
      `Could not reach ${endpoint.origin}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (res.status === 401) {
    throw new CliError("Authentication failed: invalid API key credentials");
  }
  if (!res.ok) {
    throw new CliError(`Request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as EventsResponse;
}

/**
 * Renders rows as aligned columns: each column as wide as its widest cell,
 * numeric-looking cells right-aligned, two spaces between columns. Width is
 * computed from the data, so alignment holds for any campaign name or count.
 */
export function alignColumns(rows: string[][], indent = "  "): string[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  }
  const numeric = /^[\d,.%]+$/;
  return rows.map((row) =>
    (
      indent +
      row
        .map((cell, i) => {
          const w = widths[i];
          // Last column flows free; numbers right-align under their header.
          if (i === row.length - 1) return cell;
          return numeric.test(cell) ? cell.padStart(w) : cell.padEnd(w);
        })
        .join("  ")
    ).trimEnd()
  );
}

/** Renders the scorecard as a plain-ASCII, human-readable summary. */
export function formatScorecard(
  scorecard: Scorecard,
  ctx: { url: string; from?: string; to?: string }
): string {
  const lines: string[] = [];
  lines.push("QCobro engine-eval");
  lines.push(`url:    ${ctx.url}`);
  lines.push(`range:  ${ctx.from ?? "(unbounded)"} .. ${ctx.to ?? "(unbounded)"}`);
  lines.push(
    `totals: events=${scorecard.totals.events} ticks=${scorecard.totals.ticks} ` +
      `campaigns=${scorecard.totals.campaigns} accountsConsidered=${scorecard.totals.accountsConsidered}`
  );
  if (scorecard.gaps.length === 0) {
    lines.push("gaps:   none");
  } else {
    lines.push(`gaps:   ${scorecard.gaps.length} tick(s) started but never completed`);
    for (const g of scorecard.gaps) lines.push(`  - tick ${g.tickId} at ${g.at}`);
  }
  lines.push("");
  lines.push(`VERDICT: ${scorecard.verdict.toUpperCase()}`);
  lines.push("");
  lines.push("INVARIANTS");
  lines.push(
    ...alignColumns(
      scorecard.invariants.map((inv) => [
        `[${inv.verdict === "pass" ? "PASS" : "FAIL"}]`,
        inv.id,
        inv.name,
        inv.scope,
        inv.metric ?? ""
      ])
    )
  );
  lines.push("");
  lines.push("BY CAMPAIGN");
  // Names come from the stream's campaign.evaluated events; streams recorded
  // before names existed fall back to the id.
  const campaignName = new Map(scorecard.campaigns.map((c) => [c.campaignId, c.name]));
  const displayName = (id: string) => campaignName.get(id) ?? id;
  if (scorecard.campaigns.length === 0) {
    lines.push("  (no campaigns in range)");
  } else {
    lines.push(
      ...alignColumns([
        ["campaign", "ticks", "considered", "dispatched", "failed", "suppressed", "violations"],
        ...scorecard.campaigns.map((c) => [
          c.name ?? c.campaignId,
          String(c.ticksSeen),
          String(c.considered),
          String(c.dispatched),
          String(c.failed),
          String(c.suppressed),
          Object.entries(c.violations)
            .map(([id, count]) => `${id}:${count}`)
            .join(" ") || "-"
        ])
      ])
    );
  }
  const violating = scorecard.invariants.filter((inv) => inv.violations.length > 0);
  if (violating.length > 0) {
    lines.push("");
    lines.push("VIOLATIONS");
    for (const inv of violating) {
      lines.push(`  ${inv.id} ${inv.name}`);
      for (const v of inv.violations) {
        const scope = [
          v.campaignId ? `campaign "${displayName(v.campaignId)}"` : undefined,
          v.portfolioAccountId ? `account ${v.portfolioAccountId}` : undefined
        ]
          .filter((s): s is string => Boolean(s))
          .join(", ");
        lines.push(
          `    - ${scope ? scope + ": " : ""}${v.detail} [events: ${v.eventIds.join(", ")}]`
        );
      }
    }
  }
  return lines.join("\n");
}

/**
 * Entry point. Exported (rather than only run inline) so it can be exercised
 * directly if ever needed; the module also self-invokes when run via `node`
 * or `npx` (see the guard at the bottom of the file).
 */
export async function main(
  argv: string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
  now: Date = new Date(),
  stdout: (s: string) => void = (s) => process.stdout.write(s),
  stderr: (s: string) => void = (s) => process.stderr.write(s)
): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCliArgs(argv);
  } catch (err) {
    stderr(`engine-eval: ${err instanceof Error ? err.message : String(err)}\n\n${USAGE}`);
    return 2;
  }
  if (opts.help) {
    stdout(USAGE);
    return 0;
  }

  try {
    const { accessKeyId, accessKeySecret } = resolveCredentials(opts, env);
    const range = resolveRange(opts.from, opts.to, now);
    const { events, parameters, truncated } = await fetchEvents(
      opts.url,
      range,
      accessKeyId,
      accessKeySecret
    );
    if (truncated) {
      stderr(
        "engine-eval: warning — the server truncated the event stream for this range; " +
          "verdicts may miss violations. Narrow --from/--to and re-run.\n"
      );
    }
    const evaluationParameters = evaluationParametersSchema.parse({
      tickSeconds: parameters.tickSeconds,
      ratesPerMinute: parameters.ratesPerMinute,
      thresholds: buildThresholdOverrides(opts)
    });
    const scorecard = evaluate(events, evaluationParameters);

    if (opts.json) {
      stdout(JSON.stringify(scorecard, null, 2) + "\n");
    } else {
      stdout(formatScorecard(scorecard, { url: opts.url, from: range.from, to: range.to }) + "\n");
    }
    return scorecard.verdict === "pass" ? 0 : 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stderr(`engine-eval: ${message}\n`);
    return 2;
  }
}

// Only run when this file is the process entry point (not when imported by tests).
// Compares resolved real paths, not raw strings: npm/npx always launch bins through
// a node_modules/.bin symlink, so argv[1] is the symlink path while import.meta.url
// is already resolved to the real file — a raw-string comparison never matches there,
// silently skipping main() with no output and exit code 0.
if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().then((code) => process.exit(code));
}
