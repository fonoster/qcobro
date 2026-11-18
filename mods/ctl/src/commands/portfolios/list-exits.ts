import cliui from "cliui";
import { Flags } from "@oclif/core";
import type { ListExitsInput } from "@qcobro/common";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";
import { isoDate, pageFooter, pagingFlags } from "../../commandFlags.js";

export default class ListExits extends AuthenticatedCommand<typeof ListExits> {
  static override readonly description =
    "display the accounts that left a portfolio and have not come back";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --portfolio-id <id>",
    "<%= config.bin %> <%= command.id %> --portfolio-id <id> --reason UNKNOWN"
  ];
  static override readonly flags = {
    "portfolio-id": Flags.string({ description: "the portfolio id", required: true }),
    reason: Flags.string({
      description: "only exits with this reason",
      options: ["CURED", "PAID_OFF", "WRITTEN_OFF", "OTHER", "UNKNOWN"]
    }),
    ...pagingFlags
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ListExits);
    const client = await this.createSdkClient();
    const page = await client.portfolios.listExits({
      portfolioId: flags["portfolio-id"],
      reason: flags.reason as ListExitsInput["reason"],
      limit: flags.limit,
      offset: flags.offset
    });

    const ui = cliui({ width: 160 });
    const row = (cells: string[]) =>
      ui.div(
        ...cells.map((text, i) => ({
          text,
          padding: [0, 0, 0, 0] as [number, number, number, number],
          width: [13, 20, 30, 13, 14, undefined][i]
        }))
      );

    row(["EXITED", "EXTERNAL ID", "NAME", "REASON", "INSTALLMENTS", "AMOUNT IF RECOVERED"]);
    for (const e of page.items) {
      row([
        isoDate(e.exitedAt),
        e.externalId,
        e.fullName,
        e.reason,
        String(e.missedInstallments),
        String(e.amountIfRecovered)
      ]);
    }

    this.log(ui.toString());
    this.log(pageFooter(flags.offset, page.items.length, page.total));
  }
}
