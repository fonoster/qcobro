import { PingInput } from "@qcobro/common";
import { router, publicProcedure } from "../trpc.js";

export const healthRouter = router({
  // Echoes input validated against a schema shared from @qcobro/common,
  // proving the end-to-end contract pattern.
  ping: publicProcedure.input(PingInput).query(({ input }) => ({
    message: input.message,
    at: new Date().toISOString()
  })),

  // Touches the database to prove connectivity.
  db: publicProcedure.query(async ({ ctx }) => {
    const healthChecks = await ctx.prisma.healthCheck.count();
    return { ok: true, healthChecks };
  }),

  // Reaches the Identity gRPC service to prove connectivity.
  identity: publicProcedure.query(async ({ ctx }) => {
    const { publicKey } = await ctx.identity.getPublicKey();
    return { ok: true, publicKeyLength: publicKey.length };
  })
});
