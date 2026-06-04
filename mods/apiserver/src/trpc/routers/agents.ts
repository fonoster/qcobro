import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

const CHANNEL = z.enum(["VOICE", "VOICE_AI", "WHATSAPP", "SMS", "EMAIL"]);

export const agentsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["ACTIVE", "PAUSED"]).optional(),
      strategy: z.enum(["AGGRESSIVE", "MODERATE", "GENTLE"]).optional(),
      channel: CHANNEL.optional()
    }).optional())
    .query(({ input, ctx }) =>
      ctx.prisma.agent.findMany({
        where: {
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.strategy ? { strategy: input.strategy } : {}),
          ...(input?.channel ? { channel: input.channel } : {})
        },
        orderBy: { name: "asc" }
      })
    ),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input, ctx }) => ctx.prisma.agent.findUniqueOrThrow({ where: { id: input.id } })),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      channel: CHANNEL.default("VOICE"),
      strategy: z.enum(["AGGRESSIVE", "MODERATE", "GENTLE"]).default("MODERATE")
    }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.agent.create({ data: { ...input, status: "ACTIVE" } })
    ),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      channel: CHANNEL.optional(),
      strategy: z.enum(["AGGRESSIVE", "MODERATE", "GENTLE"]).optional(),
      status: z.enum(["ACTIVE", "PAUSED"]).optional()
    }))
    .mutation(({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.prisma.agent.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input, ctx }) => ctx.prisma.agent.delete({ where: { id: input.id } }))
});
