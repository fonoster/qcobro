import { z } from "zod";

export const campaignStatusSchema = z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM 24h time");

export const createCampaignSchema = z
  .object({
    name: z.string().min(1).max(120),
    agentTemplateId: z.string().min(1),
    portfolioIds: z.array(z.string().min(1)).min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1).optional(),
    startTime: timeOfDay,
    endTime: timeOfDay,
    maxAttemptsPerAccount: z.number().int().positive(),
    maxAttemptsPerDay: z.number().int().positive()
  })
  .refine((c) => !c.endDate || new Date(c.endDate) > new Date(c.startDate), {
    message: "endDate must be after startDate",
    path: ["endDate"]
  });
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

/**
 * Updating a campaign: mutable fields only. `agentTemplateId` is immutable —
 * `.strict()` rejects any attempt to pass it (or other unknown keys).
 */
export const updateCampaignSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(120).optional(),
    status: campaignStatusSchema.optional(),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    startTime: timeOfDay.optional(),
    endTime: timeOfDay.optional(),
    maxAttemptsPerAccount: z.number().int().positive().optional(),
    maxAttemptsPerDay: z.number().int().positive().optional()
  })
  .strict();
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export const deleteCampaignSchema = z.object({
  id: z.string().min(1)
});
export type DeleteCampaignInput = z.infer<typeof deleteCampaignSchema>;
