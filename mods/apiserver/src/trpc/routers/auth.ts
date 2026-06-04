import { z } from "zod";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "change-me-in-production");

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
        throw new Error("Invalid email or password");
      }
      const token = await new SignJWT({ id: user.id, email: user.email, role: user.role })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(JWT_SECRET);
      return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
    }),

  me: protectedProcedure.query(({ ctx }) => ctx.user)
});
