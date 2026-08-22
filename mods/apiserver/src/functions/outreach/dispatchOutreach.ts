import { randomUUID } from "node:crypto";
import {
  DispatchError,
  dispatchOutreachSchema,
  pickRandomNumber,
  renderTemplate,
  renderWhatsAppTemplate,
  withErrorHandlingAndValidation,
  type DispatchDeps,
  type DispatchOutreachInput,
  type DispatchResult
} from "@qcobro/common";

/**
 * Preserves an already-classified `DispatchError` thrown by a provider client as-is —
 * only the client talking to a given provider's API can tell `DELIVERY_REJECTED` from
 * `SYSTEM_ERROR`. Anything else (a bug, a network-layer error the client didn't itself
 * catch) is wrapped as `SYSTEM_ERROR`, never `DELIVERY_REJECTED`, so an unrecognized
 * failure mode never gets mistaken for a real, budget-consuming contact attempt. The
 * raw provider message (auth, balance, rate limits) is a provider implementation
 * detail that shouldn't reach a customer-facing surface verbatim, so the wrapped
 * message stays generic while the original is chained as `cause`.
 */
function toDispatchError(label: string, err: unknown): DispatchError {
  if (err instanceof DispatchError) return err;
  return new DispatchError(
    "SYSTEM_ERROR",
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
        throw new DispatchError(
          "SYSTEM_ERROR",
          "SMS dispatch is not configured (missing Twilio settings)"
        );
      }
      if (deps.twilioFromNumbers.length === 0) {
        throw new DispatchError("SYSTEM_ERROR", "SMS dispatch has no configured sender numbers");
      }
      const from = params.from ?? pick(deps.twilioFromNumbers);
      const renderedBody = renderTemplate(params.body ?? "", params.context);
      let sid: string;
      try {
        ({ sid } = await deps.smsClient.sendMessage({ from, to: params.to, body: renderedBody }));
      } catch (err) {
        throw toDispatchError("SMS", err);
      }
      return { channel: "SMS", providerRef: sid, from, to: params.to, renderedBody };
    }

    if (params.channel === "EMAIL") {
      if (!deps.emailClient || !deps.emailFrom) {
        throw new DispatchError(
          "SYSTEM_ERROR",
          "Email dispatch is not configured (missing Resend settings)"
        );
      }
      // The per-attempt reply-to token IS the providerRef — inbound replies correlate by it.
      const token = randomUUID();
      const from = params.from ?? deps.emailFrom.email;
      const subject = renderTemplate(params.subject ?? "", params.context);
      const renderedBody = renderTemplate(params.body ?? "", params.context);
      const replyTo = `reply+${token}@${deps.emailFrom.inboundDomain}`;
      // Resend's message id is the only correlation handle its outbound delivery/open events
      // carry — the reply-to token appears in none of them — so it is kept alongside the
      // token rather than discarded (email-events-hook).
      let messageId: string | undefined;
      try {
        ({ id: messageId } = await deps.emailClient.sendEmail({
          from,
          fromName: deps.emailFrom.name,
          to: params.to,
          subject,
          body: renderedBody,
          replyTo
        }));
      } catch (err) {
        throw toDispatchError("Email", err);
      }
      return {
        channel: "EMAIL",
        providerRef: token,
        providerMessageId: messageId,
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
      // the body's {{snake_case_vars}} become Meta named parameters — see
      // `renderWhatsAppTemplate` for the snake_case-to-camelCase context mapping Meta's
      // naming rules force on this channel alone.
      if (!deps.whatsAppClient) {
        throw new DispatchError(
          "SYSTEM_ERROR",
          "WhatsApp dispatch is not configured (missing or unresolved workspace integration)"
        );
      }
      const from = params.from ?? "";
      const body = params.body ?? "";
      const { renderedBody, params: namedParams } = renderWhatsAppTemplate(body, params.context);
      let id: string;
      try {
        ({ id } = await deps.whatsAppClient.sendTemplate({
          to: params.to,
          templateName: params.templateName as string,
          languageCode: params.languageCode as string,
          params: namedParams
        }));
      } catch (err) {
        throw toDispatchError("WhatsApp", err);
      }
      return {
        channel: "WHATSAPP",
        providerRef: id,
        from,
        to: params.to,
        renderedBody
      };
    }

    // VOICE_AI | VOICE_PRERECORDED — originate a call to the synced application.
    if (!deps.outboundCallClient) {
      throw new DispatchError(
        "SYSTEM_ERROR",
        "Voice dispatch is not configured (missing Fonoster settings)"
      );
    }
    if (deps.fonosterNumbers.length === 0) {
      throw new DispatchError("SYSTEM_ERROR", "Voice dispatch has no configured caller-ID numbers");
    }
    if (!params.appRef) {
      throw new DispatchError("SYSTEM_ERROR", "Voice dispatch requires a synced application ref");
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
      // Optional DTMF menu: fixed IVR prompts, not rendered against `context` (unlike the
      // script itself). Only included when configured, so the VoiceServer's "no menu
      // configured" path needs no empty-string special-casing.
      if (params.repeatDigit) metadata.repeatDigit = params.repeatDigit;
      if (params.repeatMessage) metadata.repeatMessage = params.repeatMessage;
      if (params.maxRepeats != null) metadata.maxRepeats = String(params.maxRepeats);
      if (params.optOutDigit) metadata.optOutDigit = params.optOutDigit;
      if (params.optOutMessage) metadata.optOutMessage = params.optOutMessage;
      if (params.optOutConfirmationMessage) {
        metadata.optOutConfirmationMessage = params.optOutConfirmationMessage;
      }
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
      throw toDispatchError("Voice", err);
    }
    return { channel: params.channel, providerRef: ref, from, to: params.to, renderedBody };
  };

  return withErrorHandlingAndValidation(fn, dispatchOutreachSchema);
}
