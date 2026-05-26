import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

export const campanasRouter = router({
  list: protectedProcedure
    .input(z.object({ carteraId: z.string().optional() }))
    .query(({ input, ctx }) =>
      ctx.prisma.campana.findMany({
        where: input.carteraId ? { carteraId: input.carteraId } : undefined,
        orderBy: { createdAt: "desc" }
      })
    ),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(({ input, ctx }) =>
    ctx.prisma.campana.findUniqueOrThrow({ where: { id: input.id } })
  ),

  create: protectedProcedure
    .input(z.object({ nombre: z.string(), carteraId: z.string() }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.campana.create({ data: { ...input, estado: "PROGRAMADA", cuentas: 0 } })
    ),

  updateEstado: protectedProcedure
    .input(z.object({ id: z.string(), estado: z.enum(["PROGRAMADA", "EN_CURSO", "COMPLETADA", "CANCELADA"]) }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.campana.update({ where: { id: input.id }, data: { estado: input.estado } })
    )
});
