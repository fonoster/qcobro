import { randomUUID } from "node:crypto";
import {
  dispatchOutreachSchema,
  extractTemplateTokens,
  pickRandomNumber,
  renderTemplate,
  withErrorHandlingAndValidation,
  type DispatchDeps,
  type DispatchOutreachInput,
  type DispatchResult
} from "@qcobro/common";

/**
 * Wraps a raw provider failure (Twilio/Resend/Fonoster/Meta) in a generic, safe-to-
 * display message — the raw error is a provider implementation detail (auth, balance,
 * rate limits) that shouldn't reach a customer-facing UI verbatim — while chaining the
 * original as `cause` so callers can still log the real reason.
 */
function providerDispatchError(label: string, err: unknown): Error {
  return new Error(
    `${label} dispatch failed. The provider rejected the request — check the workspace's provider configuration.`,
    { cause: err }
  );
}

/**
 * The channel-dispatch trigger. Routes a normalized dispatch request to the
 * configured provider (Fonoster voice / Twilio SMS), rendering the body templates
 * against the customer context first and picking a sending number from the pool.
 *
 * Pure trigger: it sends and returns a {@link DispatchResult}; it never touches the
 * database, so the same function backs both the manual flow and the campaigns
 * engine. Providers are injected, so unit tests run with emulators and no live calls.
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
      let sid: string;
      try {
        ({ sid } = await deps.smsClient.sendMessage({ from, to: params.to, body: renderedBody }));
      } catch (err) {
        throw providerDispatchError("SMS", err);
      }
      return { channel: "SMS", providerRef: sid, from, to: params.to, renderedBody };
    }

    if (params.channel === "EMAIL") {
      if (!deps.emailClient || !deps.emailFrom) {
        throw new Error("Email dispatch is not configured (missing Resend settings)");
      }
      // The per-attempt reply-to token IS the providerRef — inbound replies correlate by it.
      const token = randomUUID();
      const from = params.from ?? deps.emailFrom.email;
      const subject = renderTemplate(params.subject ?? "", params.context);
      const renderedBody = renderTemplate(params.body ?? "", params.context);
      const replyTo = `reply+${token}@${deps.emailFrom.inboundDomain}`;
      try {
        await deps.emailClient.sendEmail({
          from,
          fromName: deps.emailFrom.name,
          to: params.to,
          subject,
          body: renderedBody,
          replyTo
        });
      } catch (err) {
        throw providerDispatchError("Email", err);
      }
      return {
        channel: "EMAIL",
        providerRef: token,
        from,
        to: params.to,
        renderedBody,
        renderedSubject: subject
      };
    }

    if (params.channel === "WHATSAPP") {
      // The messaging client is resolved per-call from the owning workspace's integration
      // (credentials are tenant-owned, so it cannot be injected once at boot like the
      // voice/SMS pools); the caller passes it in. The opener is an approved template:
      // the body's {{vars}} become Meta named parameters, rendered against the context.
      if (!deps.whatsAppClient) {
        throw new Error(
          "WhatsApp dispatch is not configured (missing or unresolved workspace integration)"
        );
      }
      const from = params.from ?? "";
      const body = params.body ?? "";
      const namedParams = extractTemplateTokens(body).map((token) => ({
        parameterName: token,
        text: renderTemplate(`{{${token}}}`, params.context)
      }));
      let id: string;
      try {
        ({ id } = await deps.whatsAppClient.sendTemplate({
          to: params.to,
          templateName: params.templateName as string,
          languageCode: params.languageCode as string,
          params: namedParams
        }));
      } catch (err) {
        throw providerDispatchError("WhatsApp", err);
      }
      return {
        channel: "WHATSAPP",
        providerRef: id,
        from,
        to: params.to,
        renderedBody: renderTemplate(body, params.context)
      };
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

    // Pre-recorded → EXTERNAL VoiceServer: the spoken script (locuted via TTS) is the
    // only metadata. Voz IA → AUTOPILOT: the system prompt is already stored on the
    // synced Fonoster application, so we never resend it as call metadata — that would
    // duplicate it and pollute the agent's context. We pass only the opening line.
    let metadata: Record<string, string>;
    let renderedBody: string;
    if (params.channel === "VOICE_PRERECORDED") {
      renderedBody = renderTemplate(params.script ?? "", params.context);
      metadata = { message: renderedBody };
    } else {
      renderedBody = renderTemplate(params.firstMessage ?? "", params.context);
      metadata = { firstMessage: renderedBody };
    }

    let ref: string;
    try {
      ({ ref } = await deps.outboundCallClient.createCall({
        from,
        to: params.to,
        appRef: params.appRef,
        metadata
      }));
    } catch (err) {
      throw providerDispatchError("Voice", err);
    }
    return { channel: params.channel, providerRef: ref, from, to: params.to, renderedBody };
  };

  return withErrorHandlingAndValidation(fn, dispatchOutreachSchema);
}
