import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

const CHANNEL = z.enum(["VOICE", "VOICE_AI", "WHATSAPP", "SMS", "EMAIL"]);

export const campaignsRouter = router({
  list: protectedProcedure
    .input(z.object({
      portfolioId: z.string().optional(),
      status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional()
    }).optional())
    .query(async ({ input, ctx }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const campaigns = await ctx.prisma.campaign.findMany({
        where: {
          ...(input?.portfolioId ? { portfolioId: input.portfolioId } : {}),
          ...(input?.status ? { status: input.status } : {})
        },
        include: {
          portfolio: { select: { id: true, name: true } },
          agent: { select: { id: true, name: true, channel: true } },
          _count: {
            select: {
              activities: { where: { createdAt: { gte: today, lt: tomorrow } } }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      return campaigns.map((c) => ({ ...c, todayActivities: c._count.activities }));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input, ctx }) =>
      ctx.prisma.campaign.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          portfolio: true,
          agent: { select: { id: true, name: true, channel: true } },
          activities: { orderBy: { createdAt: "desc" }, take: 20 }
        }
      })
    ),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      portfolioId: z.string(),
      agentId: z.string().optional(),
      channel: CHANNEL.default("VOICE"),
      accounts: z.number().int().nonnegative().default(0),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional()
    }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.campaign.create({
        data: {
          name: input.name,
          portfolioId: input.portfolioId,
          agentId: input.agentId || null,
          channel: input.channel,
          accounts: input.accounts,
          status: "SCHEDULED",
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null
        }
      })
    ),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      agentId: z.string().nullable().optional(),
      channel: CHANNEL.optional(),
      status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
      accounts: z.number().int().nonnegative().optional(),
      startDate: z.string().datetime().nullable().optional(),
      endDate: z.string().datetime().nullable().optional()
    }))
    .mutation(({ input, ctx }) => {
      const { id, startDate, endDate, ...rest } = input;
      return ctx.prisma.campaign.update({
        where: { id },
        data: {
          ...rest,
          ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
          ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {})
        }
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input, ctx }) => ctx.prisma.campaign.delete({ where: { id: input.id } }))
});
