import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";
import { periodFlags } from "../../commandFlags.js";

export default class Summary extends AuthenticatedCommand<typeof Summary> {
  static override readonly description = "display the amount recovered in a period";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --from 2026-10-01 --to 2026-10-31",
    "<%= config.bin %> <%= command.id %> --from 2026-10-01 --to 2026-10-31 --portfolio-id <id>"
  ];
  static override readonly flags = { ...periodFlags };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Summary);
    const client = await this.createSdkClient();
    const summary = await client.recovery.summary({
      from: flags.from,
      to: flags.to,
      portfolioId: flags["portfolio-id"]
    });

    this.log(
      `${"RECOVERED:".padEnd(20)}${summary.recovered} ${summary.currency} (${summary.count})\n` +
        `${"WITHOUT GESTION:".padEnd(20)}${summary.withoutGestion} ${summary.currency} (${summary.withoutGestionCount})\n` +
        `${"EXITS TO CLASSIFY:".padEnd(20)}${summary.pendingExits}`
    );
  }
}
