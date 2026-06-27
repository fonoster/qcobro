import { router, protectedProcedure } from "../trpc.js";
import { config } from "../../config.js";

/**
 * Read-only deployment config the console needs. Voices come from the Fonoster
 * block of `qcobro.json` (deployment-wide), so the agent-template forms render a
 * voice picker instead of free-text entry. Authed but not workspace-scoped — the
 * catalog is global. Empty when Fonoster is not configured.
 */
export const configRouter = router({
  voices: protectedProcedure.query(() => config.fonoster?.voices ?? []),
  /**
   * Deployment-wide announcement banner config (or null). Title/message may be
   * localized maps; the console resolves them against the active UI language.
   */
  announcement: protectedProcedure.query(() => config.announcement ?? null),
  /**
   * Which outbound/inbound channel integrations are configured in qcobro.json.
   * The console uses this to show status badges without exposing secrets.
   */
  channels: protectedProcedure.query(() => ({
    fonoster: !!config.fonoster,
    twilio: !!config.twilio,
    resend: !!config.resend
  }))
});
