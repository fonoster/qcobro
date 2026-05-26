import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, protectedProcedure } from "../trpc.js";

export const usersRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.user.findMany({ select: { id: true, email: true, nombre: true, rol: true, createdAt: true } })
  ),

  create: protectedProcedure
    .input(z.object({ email: z.string().email(), nombre: z.string(), password: z.string().min(8), rol: z.enum(["ADMIN", "SUPERVISOR", "AGENTE"]) }))
    .mutation(async ({ input, ctx }) => {
      const passwordHash = await bcrypt.hash(input.password, 12);
      return ctx.prisma.user.create({
        data: { email: input.email, nombre: input.nombre, rol: input.rol, passwordHash },
        select: { id: true, email: true, nombre: true, rol: true, createdAt: true }
      });
    })
});
