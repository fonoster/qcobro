import { signUpSchema, loginSchema, refreshTokenSchema } from "@qcobro/common";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { identityCall } from "../../identity/errors.js";

export const authRouter = router({
  // Current authenticated principal and the active workspace (if any).
  me: protectedProcedure.query(({ ctx }) => ({
    user: ctx.user,
    workspace: ctx.workspace
  })),

  // Anyone can create an account.
  signUp: publicProcedure.input(signUpSchema).mutation(({ ctx, input }) =>
    identityCall(() =>
      ctx.identity.createUser({
        name: input.name,
        email: input.email,
        password: input.password,
        phone: input.phone,
        avatar: input.avatar
      })
    )
  ),

  // Exchange credentials for id/access/refresh tokens.
  login: publicProcedure.input(loginSchema).mutation(({ ctx, input }) =>
    identityCall(() =>
      ctx.identity.exchangeCredentials({
        username: input.email,
        password: input.password,
        twoFactorCode: input.twoFactorCode
      })
    )
  ),

  // Exchange a refresh token for a fresh access token.
  refresh: publicProcedure
    .input(refreshTokenSchema)
    .mutation(({ ctx, input }) =>
      identityCall(() => ctx.identity.exchangeRefreshToken(input.refreshToken))
    ),

  // Logout. Fonoster Identity 0.18.2 does not implement server-side token
  // revocation, so logout is a client concern (discard the stored tokens);
  // tokens expire on their own. This is a server-side acknowledgement.
  logout: publicProcedure.mutation(() => ({ ok: true }))
});
