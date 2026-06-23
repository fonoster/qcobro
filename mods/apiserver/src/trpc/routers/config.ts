import { router, protectedProcedure } from "../trpc.js";
import { config } from "../../config.js";

/**
 * Read-only deployment config the console needs. Voices come from the Fonoster
 * block of `qcobro.json` (deployment-wide), so the agent-template forms render a
 * voice picker instead of free-text entry. Authed but not workspace-scoped — the
 * catalog is global. Empty when Fonoster is not configured.
 */
export const configRouter = router({
  voices: protectedProcedure.query(() => config.fonoster?.voices ?? [])
});
