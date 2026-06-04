import { z } from "zod";
import {
  PortfolioSchema,
  CampaignSchema,
  ActivitySchema,
  PromiseSchema,
  AgentSchema,
  UserSchema,
  LoginSchema
} from "../schemas/index.js";

export type Portfolio = z.infer<typeof PortfolioSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type Promise = z.infer<typeof PromiseSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type User = z.infer<typeof UserSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export type PortfolioStatus = Portfolio["status"];
export type CampaignStatus = Campaign["status"];
export type ActivityOutcome = Activity["outcome"];
export type ActivityChannel = Activity["channel"];
export type PromiseStatus = Promise["status"];
export type AgentStatus = Agent["status"];
export type AgentStrategy = Agent["strategy"];
export type UserRole = User["role"];
