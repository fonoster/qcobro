import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

export const carterasRouter = router({
  list: protectedProcedure.query(({ ctx }) => ctx.prisma.cartera.findMany({ orderBy: { createdAt: "desc" } })),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(({ input, ctx }) =>
    ctx.prisma.cartera.findUniqueOrThrow({ where: { id: input.id } })
  ),

  create: protectedProcedure
    .input(z.object({ nombre: z.string(), clienteId: z.string(), montoTotal: z.number() }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.cartera.create({
        data: { ...input, montoRecuperado: 0, cuentas: 0, estado: "ACTIVA" }
      })
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string(), nombre: z.string().optional(), estado: z.enum(["ACTIVA", "CERRADA"]).optional() }))
    .mutation(({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.prisma.cartera.update({ where: { id }, data });
    })
});
