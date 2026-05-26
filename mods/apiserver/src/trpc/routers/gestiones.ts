import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

export const gestionesRouter = router({
  list: protectedProcedure
    .input(z.object({ campanaId: z.string().optional(), cuentaId: z.string().optional() }))
    .query(({ input, ctx }) =>
      ctx.prisma.gestion.findMany({
        where: {
          ...(input.campanaId && { campanaId: input.campanaId }),
          ...(input.cuentaId && { cuentaId: input.cuentaId })
        },
        orderBy: { createdAt: "desc" }
      })
    ),

  create: protectedProcedure
    .input(z.object({
      campanaId: z.string(),
      cuentaId: z.string(),
      resultado: z.enum(["CONTACTADO", "NO_CONTACTADO", "PROMESA", "RECHAZO", "PENDIENTE"]),
      notas: z.string().optional(),
      agenteId: z.string().optional()
    }))
    .mutation(({ input, ctx }) => ctx.prisma.gestion.create({ data: input }))
});
