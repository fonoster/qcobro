import cliui from "cliui";
import { Args } from "@oclif/core";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";

export default class Get extends AuthenticatedCommand<typeof Get> {
  static override readonly description = "display a single portfolio";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <id>"];
  static override readonly args = {
    id: Args.string({ description: "the portfolio id", required: true })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Get);
    const client = await this.createSdkClient();
    const portfolio = await client.portfolios.get({ id: args.id });

    const ui = cliui({ width: 200 });

    ui.div(
      "PORTFOLIO\n" +
        "------------------\n" +
        `ID: \t${portfolio.id}\n` +
        `NAME: \t${portfolio.name}\n` +
        `CLIENT ID: \t${portfolio.clientId}\n` +
        `ACCOUNTS: \t${portfolio.accountCount}\n` +
        `OUTSTANDING BALANCE: \t${portfolio.totalOutstandingBalance}\n` +
        `RECOVERED: \t${portfolio.recoveredAmount}\n` +
        `LAST SYNCED: \t${portfolio.lastSyncedAt ?? "never"}\n` +
        `ARCHIVED: \t${portfolio.archivedAt ? "yes" : "no"}\n`
    );

    this.log(ui.toString());
  }
}
