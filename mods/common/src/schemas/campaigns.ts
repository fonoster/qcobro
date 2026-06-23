import { z } from "zod";

export const campaignStatusSchema = z.enum(["PAUSED", "ACTIVE", "COMPLETED", "ARCHIVED"]);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

/**
 * Valid status transitions. A new campaign starts ACTIVE (dispatching immediately).
 * COMPLETED is read-only. An ARCHIVED campaign can be restored to PAUSED — it never
 * resumes dispatch without an explicit later activation. The UI offers only the
 * transitions valid for the current status; the API enforces the same map.
 */
export const campaignStatusTransitions: Record<CampaignStatus, CampaignStatus[]> = {
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: ["PAUSED"]
};

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM 24h time");

/**
 * Days of the week the campaign runs, as ISO weekday numbers (1 = Monday … 7 = Sunday).
 * Any non-empty combination is allowed (e.g. Monday + Friday only).
 */
const daysOfWeek = z
  .array(z.number().int().min(1, "weekday must be 1–7").max(7, "weekday must be 1–7"))
  .min(1, "select at least one day")
  .refine((days) => new Set(days).size === days.length, {
    message: "days of week must be unique"
  });

export const createCampaignSchema = z
  .object({
    name: z.string().min(1).max(120),
    agentTemplateId: z.string().min(1),
    portfolioIds: z.array(z.string().min(1)).min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1).optional(),
    daysOfWeek,
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
 * Updating a campaign: mutable configuration only. `agentTemplateId` is immutable and
 * `status` is changed through {@link updateCampaignStatusSchema} (guarded transitions),
 * so `.strict()` rejects either being passed here, along with any unknown keys.
 */
export const updateCampaignSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(120).optional(),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    daysOfWeek: daysOfWeek.optional(),
    startTime: timeOfDay.optional(),
    endTime: timeOfDay.optional(),
    maxAttemptsPerAccount: z.number().int().positive().optional(),
    maxAttemptsPerDay: z.number().int().positive().optional()
  })
  .strict();
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export const updateCampaignStatusSchema = z.object({
  id: z.string().min(1),
  status: campaignStatusSchema
});
export type UpdateCampaignStatusInput = z.infer<typeof updateCampaignStatusSchema>;

export const deleteCampaignSchema = z.object({
  id: z.string().min(1)
});
export type DeleteCampaignInput = z.infer<typeof deleteCampaignSchema>;
