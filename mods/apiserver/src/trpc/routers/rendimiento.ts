import { router, protectedProcedure } from "../trpc.js";

export const rendimientoRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const [carteras, campanas, gestiones, promesas, agentes] = await Promise.all([
      ctx.prisma.cartera.count({ where: { estado: "ACTIVA" } }),
      ctx.prisma.campana.count({ where: { estado: "EN_CURSO" } }),
      ctx.prisma.gestion.count(),
      ctx.prisma.promesa.count({ where: { estado: "VENCIDA" } }),
      ctx.prisma.agente.count({ where: { estado: "ACTIVO" } })
    ]);
    const contactadas = await ctx.prisma.gestion.count({
      where: { resultado: { in: ["CONTACTADO", "PROMESA"] } }
    });
    const tasaContactabilidad = gestiones > 0 ? (contactadas / gestiones) * 100 : 0;
    return { carteras, campanas, gestiones, promesasVencidas: promesas, agentes, tasaContactabilidad };
  })
});
