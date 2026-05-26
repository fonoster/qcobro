import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

export const promesasRouter = router({
  list: protectedProcedure
    .input(z.object({ estado: z.enum(["PENDIENTE", "CUMPLIDA", "VENCIDA", "CANCELADA"]).optional() }))
    .query(({ input, ctx }) =>
      ctx.prisma.promesa.findMany({
        where: input.estado ? { estado: input.estado } : undefined,
        orderBy: { fechaPromesa: "asc" }
      })
    ),

  create: protectedProcedure
    .input(z.object({ gestionId: z.string(), cuentaId: z.string(), monto: z.number().positive(), fechaPromesa: z.string() }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.promesa.create({
        data: { ...input, fechaPromesa: new Date(input.fechaPromesa), estado: "PENDIENTE" }
      })
    ),

  updateEstado: protectedProcedure
    .input(z.object({ id: z.string(), estado: z.enum(["CUMPLIDA", "VENCIDA", "CANCELADA"]) }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.promesa.update({ where: { id: input.id }, data: { estado: input.estado } })
    )
});
