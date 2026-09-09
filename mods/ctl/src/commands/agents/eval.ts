import { readFileSync } from "node:fs";
import { Flags } from "@oclif/core";
import { parse as parseYaml } from "yaml";
import type { EvalEvent } from "@qcobro/common";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";
import { resolveInputFile } from "../../resolveInputFile.js";

export default class Eval extends AuthenticatedCommand<typeof Eval> {
  static override readonly description =
    "evaluate a VOICE_AI/EMAIL/WHATSAPP agent's conversation logic — either an existing " +
    "template plus a scenarios file, or a standalone YAML eval template (agent definition " +
    "plus its own embedded scenarios) that is never created. Streams each turn's result as " +
    "it happens, then a final pass/fail summary; exits non-zero when the run fails. Pass " +
    "--json to stream the raw events as JSONL instead. For a static SMS/VOICE_PRERECORDED " +
    "render (no conversation), use `agents:preview` instead.";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --template-id <id> --scenarios scenarios.yaml",
    "<%= config.bin %> <%= command.id %> --file eval-template.yaml",
    "<%= config.bin %> <%= command.id %> --file eval-template.yaml --json | jq"
  ];
  static override readonly flags = {
    "template-id": Flags.string({ description: "an existing agent template id" }),
    scenarios: Flags.string({
      description: "path to a YAML file with the scenarios to run (used with --template-id)"
    }),
    file: Flags.string({
      description: "path to a standalone YAML eval template (agent definition + embedded scenarios)"
    }),
    json: Flags.boolean({
      description:
        "emit each evaluation event as a JSON line (JSONL) on stdout instead of human-readable output",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Eval);
    const client = await this.createSdkClient();

    let anyFailed = false;
    for await (const event of client.agentEvaluations.evaluate(this.buildInput(flags))) {
      anyFailed = this.printEvent(event, flags.json) || anyFailed;
    }

    if (anyFailed) this.exit(1);
  }

  private buildInput(flags: {
    "template-id": string | undefined;
    scenarios: string | undefined;
    file: string | undefined;
  }) {
    if (flags.file) {
      return { yaml: readFileSync(this.resolvePath(flags.file), "utf8") };
    }
    if (flags["template-id"] && flags.scenarios) {
      const parsed = parseYaml(readFileSync(this.resolvePath(flags.scenarios), "utf8"));
      const scenarios = Array.isArray(parsed)
        ? parsed
        : ((parsed as { scenarios?: unknown }).scenarios ?? parsed);
      return {
        agentTemplateId: flags["template-id"],
        scenarios: scenarios as never
      };
    }
    return this.error("Provide --file, or both --template-id and --scenarios.", { exit: 1 });
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

  /** Renders one evaluation event (human or JSONL); returns true if it signals a failure. */
  private printEvent(event: EvalEvent, asJson: boolean): boolean {
    if (asJson) {
      this.log(JSON.stringify(event));
      return this.failed(event);
    }
    if (event.type === "turn") {
      const verdict = event.result.passed === undefined ? "" : event.result.passed ? " ✓" : " ✗";
      const detail = event.result.action ?? event.result.aiResponse ?? event.result.input;
      this.log(`[${event.scenarioRef}] turn ${event.result.turnIndex}: ${detail}${verdict}`);
      if (event.result.passed === false && event.result.errorMessage) {
        this.log(`  ↳ ${event.result.errorMessage}`);
      }
    } else if (event.type === "scenarioSummary") {
      this.log(`[${event.scenarioRef}] scenario ${event.overallPassed ? "PASSED" : "FAILED"}`);
    } else if (event.type === "summary") {
      this.log(`Overall: ${event.verdict.toUpperCase()} (${event.scenarios.length} scenario(s))`);
    } else {
      this.log(`Error: ${event.message}`);
    }
    return this.failed(event);
  }
}
