import { Flags } from "@oclif/core";
import type { SyncAccountsInput } from "@qcobro/common";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";
import { readJsonFile } from "../../readJsonFile.js";

export default class Sync extends AuthenticatedCommand<typeof Sync> {
  static override readonly description =
    "synchronize a batch of account rows into a portfolio, from a JSON file";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --portfolio-id <id> --file rows.json --mode APPEND_ONLY",
    "<%= config.bin %> <%= command.id %> --portfolio-id <id> --file rows.json --exits exits.json --mode REPLACE"
  ];
  static override readonly flags = {
    "portfolio-id": Flags.string({ description: "the portfolio id", required: true }),
    file: Flags.string({
      description: "path to a JSON file containing an array of account rows"
    }),
    exits: Flags.string({
      description:
        "path to a JSON file containing an array of { externalId, reason, missedInstallments, termsAmount } (the last two only for CURED and PAID_OFF)"
    }),
    mode: Flags.string({
      description: "merge strategy",
      options: ["APPEND_ONLY", "UPDATE_EXISTING", "REPLACE"],
      default: "APPEND_ONLY"
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Sync);

    if (!flags.file && !flags.exits) {
      this.error("pass --file, --exits or both", { exit: 1 });
    }
    if (!flags.file && flags.mode === "REPLACE") {
      this.error(
        "--file is required in REPLACE mode (an empty batch would archive every account)",
        { exit: 1 }
      );
    }

    const rows = flags.file ? this.readInput(flags.file) : [];
    const exits = flags.exits ? this.readInput(flags.exits) : undefined;

    const client = await this.createSdkClient();
    const result = await client.portfolios.syncAccounts({
      portfolioId: flags["portfolio-id"],
      mode: flags.mode as SyncAccountsInput["mode"],
      rows: rows as SyncAccountsInput["rows"],
      ...(exits === undefined ? {} : { exits: exits as SyncAccountsInput["exits"] })
    });

    this.log(
      `Synced: ${result.created} created, ${result.updated} updated, ${result.archived} archived (total ${result.total}).`
    );

    const { partial, cured, paidOff, amount } = result.recoveries;
    if (partial + cured + paidOff > 0) {
      this.log(
        `Recovered: ${partial} partial, ${cured} cured, ${paidOff} paid off (amount ${amount}).`
      );
    }

    const byReason = result.exitsByReason;
    const extra = byReason.classified + byReason.skipped > 0;
    const exitCounts = [
      byReason.CURED,
      byReason.PAID_OFF,
      byReason.WRITTEN_OFF,
      byReason.OTHER,
      byReason.UNKNOWN
    ];
    if (extra || exitCounts.some((n) => n > 0)) {
      this.log(
        `Exits: ${byReason.CURED} cured, ${byReason.PAID_OFF} paid off, ${byReason.WRITTEN_OFF} written off, ${byReason.OTHER} other, ${byReason.UNKNOWN} unknown` +
          (extra ? `, ${byReason.classified} classified, ${byReason.skipped} skipped` : "") +
          "."
      );
    }
  }

  private readInput(path: string): unknown {
    try {
      return readJsonFile(path);
    } catch (err) {
      return this.error((err as Error).message, { exit: 1 });
    }
  }
}
