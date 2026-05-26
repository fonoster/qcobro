import { z } from "zod";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { router, publicProcedure } from "../trpc.js";
import { LoginSchema } from "@qcobro/common";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "change-me-in-production");

export const authRouter = router({
  login: publicProcedure.input(LoginSchema).mutation(async ({ input, ctx }) => {
    const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new Error("Invalid credentials");
    }
    const token = await new SignJWT({ id: user.id, email: user.email, rol: user.rol })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(JWT_SECRET);
    return { token, user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } };
  }),

  me: publicProcedure.query(({ ctx }) => ctx.user)
});
