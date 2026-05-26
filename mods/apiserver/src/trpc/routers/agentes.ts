import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

export const agentesRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.agente.findMany({ orderBy: { createdAt: "desc" } })
  ),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(({ input, ctx }) =>
    ctx.prisma.agente.findUniqueOrThrow({ where: { id: input.id } })
  ),

  create: protectedProcedure
    .input(z.object({ nombre: z.string(), estrategia: z.enum(["AGRESIVO", "MODERADO", "SUAVE"]) }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.agente.create({
        data: { ...input, estado: "ACTIVO", llamadas: 0, promesas: 0, recuperado: 0, tasaExito: 0 }
      })
    ),

  updateEstado: protectedProcedure
    .input(z.object({ id: z.string(), estado: z.enum(["ACTIVO", "PAUSADO"]) }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.agente.update({ where: { id: input.id }, data: { estado: input.estado } })
    )
});
