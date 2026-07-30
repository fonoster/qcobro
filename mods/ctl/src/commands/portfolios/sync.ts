import { readFileSync } from "node:fs";
import { Flags } from "@oclif/core";
import type { SyncAccountsInput } from "@qcobro/common";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";

export default class Sync extends AuthenticatedCommand<typeof Sync> {
  static override readonly description =
    "synchronize a batch of account rows into a portfolio, from a JSON file";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --portfolio-id <id> --file rows.json --mode APPEND_ONLY"
  ];
  static override readonly flags = {
    "portfolio-id": Flags.string({ description: "the portfolio id", required: true }),
    file: Flags.string({
      description: "path to a JSON file containing an array of account rows",
      required: true
    }),
    mode: Flags.string({
      description: "merge strategy",
      options: ["APPEND_ONLY", "UPDATE_EXISTING", "REPLACE"],
      default: "APPEND_ONLY"
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Sync);
    const client = await this.createSdkClient();

    let rows: unknown;
    try {
      rows = JSON.parse(readFileSync(flags.file, "utf8"));
    } catch (err) {
      this.error(
        `Could not read/parse ${flags.file}: ${err instanceof Error ? err.message : err}`,
        {
          exit: 1
        }
      );
    }

    const result = await client.portfolios.syncAccounts({
      portfolioId: flags["portfolio-id"],
      mode: flags.mode as SyncAccountsInput["mode"],
      rows: rows as SyncAccountsInput["rows"]
    });

    this.log(
      `Synced: ${result.created} created, ${result.updated} updated, ${result.archived} archived (total ${result.total}).`
    );
  }
}
