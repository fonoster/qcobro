import { updateProfileSchema } from "@qcobro/common";
import { router, protectedProcedure } from "../trpc.js";
import { identityCall } from "../identityCall.js";

export const profileRouter = router({
  get: protectedProcedure.query(({ ctx }) =>
    identityCall(() => ctx.identity.getUser(ctx.user.ref, ctx.token))
  ),

  update: protectedProcedure
    .input(updateProfileSchema)
    .mutation(({ ctx, input }) =>
      identityCall(() => ctx.identity.updateUser({ ref: ctx.user.ref, ...input }, ctx.token))
    ),

  delete: protectedProcedure.mutation(({ ctx }) =>
    identityCall(() => ctx.identity.deleteUser(ctx.user.ref, ctx.token))
  )
});
