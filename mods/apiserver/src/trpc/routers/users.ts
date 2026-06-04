import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, protectedProcedure } from "../trpc.js";

export const usersRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { name: "asc" }
    })
  ),

  create: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      role: z.enum(["ADMIN", "SUPERVISOR", "AGENT"]).default("AGENT"),
      password: z.string().min(6)
    }))
    .mutation(async ({ input, ctx }) => {
      const passwordHash = await bcrypt.hash(input.password, 10);
      return ctx.prisma.user.create({
        data: { email: input.email, name: input.name, role: input.role, passwordHash },
        select: { id: true, email: true, name: true, role: true, createdAt: true }
      });
    }),

  updateRole: protectedProcedure
    .input(z.object({ id: z.string(), role: z.enum(["ADMIN", "SUPERVISOR", "AGENT"]) }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.user.update({
        where: { id: input.id },
        data: { role: input.role },
        select: { id: true, email: true, name: true, role: true, createdAt: true }
      })
    )
});
