import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
// @ts-ignore — CJS interop
import SDK from "@fonoster/sdk";

const APP_REF    = "855ed1fa-e536-4fc4-965c-26cc02d611e5";
const FROM       = "18297340812";
const ACCESS_KEY = "WOub8kbgmw31n3fb7vcxd01ddvmehjqzx2";
const API_KEY    = "AP11nl9agyvkbrn4wi1cpjcsg8ispjq40o";
const API_SECRET = "c4zQjXjEtjAKndTVf4Zk5GjutQXoGMLjfVk3mDe0jjSiC7uacvlLnCzpZyTbPbwI";

// Demo-fixed negotiation options matching the recording
const NEGOTIATION = "600 pesos semanal con 11 cuotas|550 pesos semanal con 13 cuotas";

export const callsRouter = router({
  make: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const account = await ctx.prisma.account.findFirst({
        where: { OR: [{ id: input.accountId }, { externalId: input.accountId }] }
      });

      if (!account?.phone) throw new Error("Cuenta sin número de teléfono");

      const metadata = {
        customerName:     account.fullName.split(" ")[0],
        loanId:           account.externalId,
        principal:        String(Math.round(account.outstandingBalance)),
        paymentAmount:    "650",
        paymentFrequency: "semanal",
        missedPayments:   String(account.missedInstallments),
        negotiation:      NEGOTIATION
      };

      const client = new SDK.Client({ accessKeyId: ACCESS_KEY });
      await client.loginWithApiKey(API_KEY, API_SECRET);

      const calls = new SDK.Calls(client);
      await calls.createCall({ from: FROM, to: account.phone, appRef: APP_REF, metadata });

      return { status: "enviada" };
    })
});
