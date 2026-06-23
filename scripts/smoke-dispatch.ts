/**
 * TEMPORARY smoke test for the channel-dispatch trigger layer. Drives the REAL
 * code path (dispatchOutreach -> Fonoster/Twilio adapters) against live providers,
 * loading credentials from qcobro.json. One channel per run.
 *
 *   node --import tsx scripts/smoke-dispatch.ts voice       <toNumber> <appRef> [fromNumber]
 *   node --import tsx scripts/smoke-dispatch.ts prerecorded <toNumber> [fromNumber]
 *   node --import tsx scripts/smoke-dispatch.ts sms         <toNumber> [fromNumber]
 *
 * Delete this file once dispatch is verified.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { qcobroConfigSchema } from "@qcobro/common";
import { createDispatchOutreach } from "../mods/apiserver/src/functions/outreach/dispatchOutreach.ts";
import { FonosterOutboundCallClient } from "../mods/apiserver/src/services/fonosterOutboundCallClient.ts";
import { TwilioSmsClient } from "../mods/apiserver/src/services/twilioSmsClient.ts";
import { FonosterVoiceApplicationClient } from "../mods/apiserver/src/services/fonosterVoiceApplicationClient.ts";

const config = qcobroConfigSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), "qcobro.json"), "utf8"))
);

const [channel, to, arg3, arg4] = process.argv.slice(2);

// A representative customer render context — proves Handlebars personalization.
const context = {
  firstName: "Pedro",
  fullName: "Pedro Sanders",
  outstandingBalance: 1500,
  currency: "CRC",
  daysPastDue: 30
};

async function main() {
  console.log(`▶ smoke ${channel} -> ${to}`);
  if (channel === "voice") {
    const appRef = arg3;
    const from = arg4 ?? "18297340812";
    if (!to || !appRef) throw new Error("Usage: voice <toNumber> <appRef> [fromNumber]");
    if (!config.fonoster) throw new Error("qcobro.json has no fonoster config");

    const dispatch = createDispatchOutreach({
      outboundCallClient: new FonosterOutboundCallClient(config.fonoster),
      smsClient: null,
      fonosterNumbers: [from],
      twilioFromNumbers: [],
      pickNumber: (n) => n[0]
    });

    const result = await dispatch({
      channel: "VOICE_AI",
      to,
      context,
      appRef,
      firstMessage:
        "Hola {{firstName}}, le llamamos de QCobro sobre su saldo de {{outstandingBalance}} {{currency}}.",
      systemPrompt:
        "Eres un agente de cobranza amable. El cliente {{firstName}} tiene {{daysPastDue}} días de mora."
    });
    console.log("✅ Voz IA dispatch result:", result);
    process.exit(0);
  }

  if (channel === "createapp") {
    if (!config.fonoster) throw new Error("qcobro.json has no fonoster config");
    const voice = config.fonoster.voices[0];
    if (!voice) throw new Error("no voices configured");
    const client = new FonosterVoiceApplicationClient(config.fonoster);
    const result = await client.createApplication({
      name: `Smoke Voz IA ${Date.now()}`,
      voice: voice.id,
      systemPrompt: "Eres un agente de cobranza amable y profesional.",
      firstMessage: "Hola, le llamo de QCobro.",
      language: "es"
    });
    console.log("✅ createApplication result:", result);
    process.exit(0);
  }

  if (channel === "prerecorded") {
    const from = arg3 ?? "18297340812";
    if (!to) throw new Error("Usage: prerecorded <toNumber> [fromNumber]");
    if (!config.fonoster) throw new Error("qcobro.json has no fonoster config");
    const appRef = config.fonoster.prerecordedAppRef;
    if (!appRef) throw new Error("qcobro.json has no fonoster.prerecordedAppRef");

    const dispatch = createDispatchOutreach({
      outboundCallClient: new FonosterOutboundCallClient(config.fonoster),
      smsClient: null,
      fonosterNumbers: [from],
      twilioFromNumbers: [],
      pickNumber: (n) => n[0]
    });

    const result = await dispatch({
      channel: "VOICE_PRERECORDED",
      to,
      context,
      appRef,
      firstMessage:
        "Hola {{firstName}}, este es un recordatorio de QCobro sobre su saldo de {{outstandingBalance}} {{currency}}."
    });
    console.log("✅ Pre-recorded dispatch result:", result);
    process.exit(0);
  }

  if (channel === "sms") {
    const from = arg3;
    if (!to) throw new Error("Usage: sms <toNumber> [fromNumber]");
    if (!config.twilio) throw new Error("qcobro.json has no twilio config");
    const fromNumbers = from ? [from] : config.twilio.fromNumbers;

    const dispatch = createDispatchOutreach({
      outboundCallClient: null,
      smsClient: new TwilioSmsClient(config.twilio),
      fonosterNumbers: [],
      twilioFromNumbers: fromNumbers,
      pickNumber: (n) => n[0]
    });

    const result = await dispatch({
      channel: "SMS",
      to,
      context,
      body: "Hola {{firstName}}, su saldo pendiente es {{outstandingBalance}} {{currency}}. — QCobro"
    });
    console.log("✅ SMS dispatch result:", result);
    process.exit(0);
  }

  throw new Error("First arg must be 'voice', 'prerecorded', or 'sms'");
}

main().catch((e) => {
  console.error("❌ dispatch failed:", e);
  process.exit(1);
});
