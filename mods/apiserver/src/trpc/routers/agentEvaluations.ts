import { evaluateInputSchema } from "@qcobro/common";
import { router, workspaceProcedure } from "../trpc.js";
import { createEvaluateAgent } from "../../functions/agentEvaluations/evaluateAgent.js";

export const agentEvaluationsRouter = router({
  // Streams over the same WebSocket transport as `campaigns.contactLog.onChange`
  // (realtime-streaming capability) — see `mods/apiserver/src/index.ts`'s `/trpc-ws`
  // mount. Unlike that subscription, this one needs no event bus: the handler itself
  // runs the evaluation and yields events directly as they're produced.
  evaluate: workspaceProcedure
    .input(evaluateInputSchema)
    .subscription(({ input, ctx }) =>
      createEvaluateAgent(
        ctx.prisma as never,
        ctx.workspace.accessKeyId,
        ctx.voiceApplications,
        ctx.emailAutopilot,
        ctx.whatsAppAutopilot,
        ctx.emailMaxRepliesDefault,
        ctx.whatsAppMaxRepliesDefault,
        ctx.textSimilarityJudge
      )(input)
    )
});
