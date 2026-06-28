import { updateProfileSchema, updateUserLanguageSchema } from "@qcobro/common";
import { router, protectedProcedure } from "../trpc.js";
import { identityCall } from "../identityCall.js";
import { createGetUserSettings } from "../../functions/userSettings/getUserSettings.js";
import { createUpdateUserLanguage } from "../../functions/userSettings/updateUserLanguage.js";

export const profileRouter = router({
  // Identity profile (name/email/phone) enriched with the app-owned language preference.
  get: protectedProcedure.query(async ({ ctx }) => {
    const [user, settings] = await Promise.all([
      identityCall(() => ctx.identity.getUser(ctx.user.ref, ctx.token)),
      createGetUserSettings(ctx.prisma as never)(ctx.user.ref)
    ]);
    return { ...user, language: settings.language };
  }),

  update: protectedProcedure
    .input(updateProfileSchema)
    .mutation(({ ctx, input }) =>
      identityCall(() => ctx.identity.updateUser({ ref: ctx.user.ref, ...input }, ctx.token))
    ),

  // App-owned language preference (kept separate from the Identity profile update).
  setLanguage: protectedProcedure
    .input(updateUserLanguageSchema)
    .mutation(({ ctx, input }) =>
      createUpdateUserLanguage(ctx.prisma as never, ctx.user.ref)(input)
    ),

  delete: protectedProcedure.mutation(({ ctx }) =>
    identityCall(() => ctx.identity.deleteUser(ctx.user.ref, ctx.token))
  )
});
