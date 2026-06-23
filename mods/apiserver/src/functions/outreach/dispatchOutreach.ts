import {
  dispatchOutreachSchema,
  pickRandomNumber,
  renderTemplate,
  withErrorHandlingAndValidation,
  type DispatchDeps,
  type DispatchOutreachInput,
  type DispatchResult
} from "@qcobro/common";

/**
 * The channel-dispatch trigger. Routes a normalized dispatch request to the
 * configured provider (Fonoster voice / Twilio SMS), rendering the body templates
 * against the customer context first and picking a sending number from the pool.
 *
 * Pure trigger: it sends and returns a {@link DispatchResult}; it never touches the
 * database, so the same function backs both the manual flow and the campaigns
 * engine. Providers are injected, so unit tests run with stubs and no live calls.
 */
export function createDispatchOutreach(deps: DispatchDeps) {
  const pick = deps.pickNumber ?? pickRandomNumber;

  const fn = async (params: DispatchOutreachInput): Promise<DispatchResult> => {
    if (params.channel === "SMS") {
      if (!deps.smsClient) {
        throw new Error("SMS dispatch is not configured (missing Twilio settings)");
      }
      if (deps.twilioFromNumbers.length === 0) {
        throw new Error("SMS dispatch has no configured sender numbers");
      }
      const from = params.from ?? pick(deps.twilioFromNumbers);
      const renderedBody = renderTemplate(params.body ?? "", params.context);
      const { sid } = await deps.smsClient.sendMessage({ from, to: params.to, body: renderedBody });
      return { channel: "SMS", providerRef: sid, from, to: params.to, renderedBody };
    }

    // VOICE_AI | VOICE_PRERECORDED — originate a call to the synced application.
    if (!deps.outboundCallClient) {
      throw new Error("Voice dispatch is not configured (missing Fonoster settings)");
    }
    if (deps.fonosterNumbers.length === 0) {
      throw new Error("Voice dispatch has no configured caller-ID numbers");
    }
    if (!params.appRef) {
      throw new Error("Voice dispatch requires a synced application ref");
    }

    const from = params.from ?? pick(deps.fonosterNumbers);
    const renderedBody = renderTemplate(params.firstMessage ?? "", params.context);

    // Pre-recorded → EXTERNAL VoiceServer: the only metadata is the ready message.
    // Voz IA → AUTOPILOT: pass the conversation settings (first message + prompt).
    let metadata: Record<string, string>;
    if (params.channel === "VOICE_PRERECORDED") {
      metadata = { message: renderedBody };
    } else {
      metadata = { firstMessage: renderedBody };
      if (params.systemPrompt) {
        metadata.systemPrompt = renderTemplate(params.systemPrompt, params.context);
      }
    }

    const { ref } = await deps.outboundCallClient.createCall({
      from,
      to: params.to,
      appRef: params.appRef,
      metadata
    });
    return { channel: params.channel, providerRef: ref, from, to: params.to, renderedBody };
  };

  return withErrorHandlingAndValidation(fn, dispatchOutreachSchema);
}
