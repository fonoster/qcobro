import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Flags } from "@oclif/core";
import { parse as parseYaml } from "yaml";
import type { EvalEvent } from "@qcobro/common";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";
import type { ReportModel } from "../../evalReport.js";
import { resolveInputFile } from "../../resolveInputFile.js";

/** The two ways to point the evaluation at an agent, mirroring `evaluateInputSchema`. */
type EvalInput = { yaml: string } | { agentTemplateId: string; scenarios: never };

/** One scenario's metadata, harvested locally from the parsed YAML for the report. */
type ScenarioMeta = {
  description: string;
  turnCount: number;
  /** The scenario's `account` block — the per-call metadata handed to the agent. */
  account?: Record<string, unknown>;
};

export default class Eval extends AuthenticatedCommand<typeof Eval> {
  static override readonly description =
    "evaluate a VOICE_AI/EMAIL/WHATSAPP agent's conversation logic — either an existing " +
    "template plus a scenarios file, or a standalone YAML eval template (agent definition " +
    "plus its own embedded scenarios) that is never created. Streams each turn's result as " +
    "it happens, then a final pass/fail summary; exits non-zero when the run fails. Use " +
    "--format to pick the output (text stream, JSONL, or an html/pdf report) and --output " +
    "to write it to a file. For a static SMS/VOICE_PRERECORDED render (no conversation), use " +
    "`agents:preview` instead.";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --template-id <id> --scenarios scenarios.yaml",
    "<%= config.bin %> <%= command.id %> --file eval-template.yaml",
    "<%= config.bin %> <%= command.id %> --file eval-template.yaml --format json --output run.json",
    "<%= config.bin %> <%= command.id %> --file eval-template.yaml --format pdf --output report.pdf"
  ];
  static override readonly flags = {
    "template-id": Flags.string({ description: "an existing agent template id" }),
    scenarios: Flags.string({
      description: "path to a YAML file with the scenarios to run (used with --template-id)"
    }),
    file: Flags.string({
      description: "path to a standalone YAML eval template (agent definition + embedded scenarios)"
    }),
    format: Flags.string({
      options: ["text", "json", "html", "pdf"],
      default: "text",
      description:
        "text = human-readable stream (default); json = JSONL of raw events; html/pdf = a " +
        "self-contained evaluation report (requires --output)"
    }),
    output: Flags.string({
      description: "write output to this file instead of stdout (required for html/pdf)"
    }),
    title: Flags.string({
      description:
        "report title for --format html/pdf (default is generic; pass a client name at run " +
        "time if you want one)"
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Eval);
    const { format, output } = flags;

    if ((format === "html" || format === "pdf") && !output) {
      this.error(`--format ${format} requires --output <file>`, { exit: 1 });
    }

    const { input, scenariosMeta } = this.buildInput(flags);
    const client = await this.createSdkClient();

    const stdoutStream = !output && (format === "text" || format === "json");

    if (output && (format === "text" || format === "json")) {
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, "");
    }

    const events: EvalEvent[] = [];
    let anyFailed = false;
    let scenarioCount = 0;
    let scenarioPass = 0;

    for await (const event of client.agentEvaluations.evaluate(input)) {
      if (event.type === "scenarioSummary") {
        scenarioCount += 1;
        if (event.overallPassed) scenarioPass += 1;
      }

      if (format === "text") {
        const line = this.humanLine(event);
        if (stdoutStream) this.log(line);
        else appendFileSync(output as string, `${line}\n`);
      } else if (format === "json") {
        const line = JSON.stringify(event);
        if (stdoutStream) this.log(line);
        else appendFileSync(output as string, `${line}\n`);
      } else {
        events.push(event);
      }

      anyFailed = this.failed(event) || anyFailed;

      if (!stdoutStream && event.type === "scenarioSummary") {
        this.logToStderr(`[${event.scenarioRef}] ${event.overallPassed ? "PASSED" : "FAILED"}`);
      }
    }

    let model: ReportModel | undefined;
    if (format === "html" || format === "pdf") {
      const { buildReportModel, renderHtml, renderPdf } = await import("../../evalReport.js");
      model = buildReportModel(events, scenariosMeta, { title: flags.title });
      mkdirSync(dirname(output as string), { recursive: true });
      if (format === "html") {
        writeFileSync(output as string, renderHtml(model), "utf8");
      } else {
        writeFileSync(output as string, await renderPdf(model));
      }
    }

    if (!stdoutStream) {
      const pass = model?.summary.pass ?? scenarioPass;
      const total = model?.summary.total ?? scenarioCount;
      this.logToStderr(`wrote ${output} (${pass}/${total} scenarios)`);
    }

    if (anyFailed) this.exit(1);
  }

  private buildInput(flags: {
    "template-id": string | undefined;
    scenarios: string | undefined;
    file: string | undefined;
  }): { input: EvalInput; scenariosMeta: Map<string, ScenarioMeta> } {
    if (flags.file) {
      const yaml = readFileSync(this.resolvePath(flags.file), "utf8");
      const parsed = parseYaml(yaml) as { scenarios?: unknown };
      return { input: { yaml }, scenariosMeta: this.scenarioMeta(parsed?.scenarios) };
    }
    if (flags["template-id"] && flags.scenarios) {
      const parsed = parseYaml(readFileSync(this.resolvePath(flags.scenarios), "utf8"));
      const scenarios = Array.isArray(parsed)
        ? parsed
        : ((parsed as { scenarios?: unknown }).scenarios ?? parsed);
      return {
        input: { agentTemplateId: flags["template-id"], scenarios: scenarios as never },
        scenariosMeta: this.scenarioMeta(scenarios)
      };
    }
    return this.error("Provide --file, or both --template-id and --scenarios.", { exit: 1 });
  }

  /** Builds `ref -> { description, turnCount, account }` from the parsed `scenarios[]` (either input mode). */
  private scenarioMeta(raw: unknown): Map<string, ScenarioMeta> {
    const meta = new Map<string, ScenarioMeta>();
    if (!Array.isArray(raw)) return meta;
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const scenario = entry as {
        ref?: unknown;
        description?: unknown;
        turns?: unknown;
        account?: unknown;
      };
      if (typeof scenario.ref !== "string") continue;
      meta.set(scenario.ref, {
        description: typeof scenario.description === "string" ? scenario.description : "",
        turnCount: Array.isArray(scenario.turns) ? scenario.turns.length : 0,
        account:
          scenario.account &&
          typeof scenario.account === "object" &&
          !Array.isArray(scenario.account)
            ? (scenario.account as Record<string, unknown>)
            : undefined
      });
    }
    return meta;
  }

  /** Resolves a `--file` / `--scenarios` path, failing the command cleanly if it is missing. */
  private resolvePath(input: string): string {
    try {
      return resolveInputFile(input);
    } catch (err) {
      return this.error(err instanceof Error ? err.message : String(err), { exit: 1 });
    }
  }

  /** Whether an event signals a failed turn / scenario / run. */
  private failed(event: EvalEvent): boolean {
    if (event.type === "turn") return event.result.passed === false;
    if (event.type === "scenarioSummary") return !event.overallPassed;
    if (event.type === "summary") return event.verdict === "fail";
    return true; // error
  }

  /** Renders one evaluation event as human-readable line(s) (no trailing newline). */
  private humanLine(event: EvalEvent): string {
    if (event.type === "turn") {
      const verdict = event.result.passed === undefined ? "" : event.result.passed ? " ✓" : " ✗";
      const detail = event.result.action ?? event.result.aiResponse ?? event.result.input;
      let line = `[${event.scenarioRef}] turn ${event.result.turnIndex}: ${detail}${verdict}`;
      if (event.result.passed === false && event.result.errorMessage) {
        line += `\n  ↳ ${event.result.errorMessage}`;
      }
      return line;
    }
    if (event.type === "scenarioSummary") {
      return `[${event.scenarioRef}] scenario ${event.overallPassed ? "PASSED" : "FAILED"}`;
    }
    if (event.type === "summary") {
      return `Overall: ${event.verdict.toUpperCase()} (${event.scenarios.length} scenario(s))`;
    }
    return `Error: ${event.message}`;
  }
}
