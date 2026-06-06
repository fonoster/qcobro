import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create({
  // Surface a machine-readable category on every error so clients can branch
  // on the failure type without parsing message strings.
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        category: error.code
      }
    };
  }
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Procedure guard for authenticated requests. Auth resolution is deferred, so
 * this currently rejects every call — it exists to establish the seam.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
