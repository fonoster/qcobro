import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

export const commitmentsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["PENDING", "FULFILLED", "OVERDUE", "CANCELLED"]).optional(),
      type: z.enum(["PAYMENT_PROMISE", "RENEGOTIATION", "MESSAGE_DELIVERY"]).optional(),
      accountId: z.string().optional(),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().nonnegative().default(0)
    }).optional())
    .query(async ({ input, ctx }) => {
      const where = {
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.type ? { type: input.type } : {}),
        ...(input?.accountId ? { accountId: input.accountId } : {})
      };
      const [items, total] = await ctx.prisma.$transaction([
        ctx.prisma.commitment.findMany({
          where,
          include: { activity: { include: { campaign: { select: { id: true, name: true } } } } },
          orderBy: { dueDate: "asc" },
          take: input?.limit ?? 50,
          skip: input?.offset ?? 0
        }),
        ctx.prisma.commitment.count({ where })
      ]);
      return { items, total };
    }),

  create: protectedProcedure
    .input(z.object({
      activityId: z.string(),
      accountId: z.string(),
      type: z.enum(["PAYMENT_PROMISE", "RENEGOTIATION", "MESSAGE_DELIVERY"]).default("PAYMENT_PROMISE"),
      amount: z.number().nonnegative().default(0),
      dueDate: z.string().datetime(),
      notes: z.string().optional()
    }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.commitment.create({
        data: { ...input, dueDate: new Date(input.dueDate), status: "PENDING" }
      })
    ),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(["PENDING", "FULFILLED", "OVERDUE", "CANCELLED"])
    }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.commitment.update({ where: { id: input.id }, data: { status: input.status } })
    ),

  markOverdue: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    const result = await ctx.prisma.commitment.updateMany({
      where: { status: "PENDING", dueDate: { lt: now } },
      data: { status: "OVERDUE" }
    });
    return { updated: result.count };
  })
});
