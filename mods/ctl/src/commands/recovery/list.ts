import cliui from "cliui";
import { Flags } from "@oclif/core";
import type { RecoveryListInput } from "@qcobro/common";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";
import { isoDate, pageFooter, pagingFlags, periodFlags } from "../../commandFlags.js";

export default class List extends AuthenticatedCommand<typeof List> {
  static override readonly description = "list the recoveries detected in a period";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --from 2026-10-01 --to 2026-10-31",
    "<%= config.bin %> <%= command.id %> --from 2026-10-01 --to 2026-10-31 --kind CURED --no-has-gestion"
  ];
  static override readonly flags = {
    ...periodFlags,
    kind: Flags.string({
      description: "only recoveries of this kind",
      options: ["PARTIAL", "CURED", "PAID_OFF"]
    }),
    "has-gestion": Flags.boolean({
      description: "only recoveries with (or, with --no-has-gestion, without) a gestión",
      allowNo: true
    }),
    ...pagingFlags
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = await this.createSdkClient();
    const page = await client.recovery.list({
      from: flags.from,
      to: flags.to,
      portfolioId: flags["portfolio-id"],
      kind: flags.kind as RecoveryListInput["kind"],
      hasGestion: flags["has-gestion"],
      limit: flags.limit,
      offset: flags.offset
    });

    const ui = cliui({ width: 140 });
    const row = (cells: string[]) =>
      ui.div(
        ...cells.map((text, i) => ({
          text,
          padding: [0, 0, 0, 0] as [number, number, number, number],
          width: [13, 20, 10, 14, 12, undefined][i]
        }))
      );

    row(["DETECTED", "EXTERNAL ID", "KIND", "INSTALLMENTS", "AMOUNT", "GESTION"]);
    for (const r of page.items) {
      row([
        isoDate(r.detectedAt),
        r.externalId,
        r.kind,
        String(r.installments),
        String(r.amount),
        r.context.lastTouch?.agentType ?? "-"
      ]);
    }

    this.log(ui.toString());
    this.log(pageFooter(flags.offset, page.items.length, page.total));
  }
}
