import { test, expect } from "@playwright/test";
import {
  addAccount,
  callsTo,
  completeCall,
  configuredNumbers,
  createVoiceAiTemplate,
  fakeApplication,
  newVoiceWorkspace,
  promisesFor,
  redeliverEvent,
  scriptCall,
  scriptPromiseCall,
  uniquePhone,
  waitFor,
  waitForGestion
} from "./support/voice.js";

/**
 * A Voz IA call end to end against the Fonoster fake, in the dev container: the template
 * syncs to an AUTOPILOT app, `outreach.dispatch` places the call, the test hangs it up, the
 * signed webhooks finalize the gestión and the outcome decision (the mock autopilot) records
 * the payment promise. No UI: everything goes through @qcobro/sdk and the fake's control API.
 */
test.describe("Voz IA call", () => {
  test("a VOICE_AI template syncs to an AUTOPILOT app in the fake", async () => {
    const { client } = await newVoiceWorkspace("voz-sync");
    const template = await createVoiceAiTemplate(client);

    expect(template.appRef).not.toBeNull();
    const app = await fakeApplication(template.appRef!);
    expect(app?.type).toBe("AUTOPILOT");
  });

  test("an answered call where the caller promises to pay ends with a pending promise", async () => {
    const { client, portfolioId } = await newVoiceWorkspace("voz-promesa");
    const template = await createVoiceAiTemplate(client);
    const phone = uniquePhone();
    const accountId = await addAccount(client, portfolioId, phone);

    const { callRef, contactLogId } = await scriptPromiseCall(client, {
      portfolioAccountId: accountId,
      phone,
      agentTemplateId: template.id
    });

    const [call] = await callsTo(phone);
    expect(call.ref).toBe(callRef);
    expect(call.appRef).toBe(template.appRef);
    expect(configuredNumbers()).toContain(call.from);

    const gestion = await client.trpc.campaigns.contactLog.get.query({ id: contactLogId });
    expect(gestion).toMatchObject({
      agentType: "VOICE_AI",
      delivery: "DELIVERED",
      path: "ENGAGED",
      outcome: "PAYMENT_PROMISE"
    });
    const promises = await promisesFor(client, accountId);
    expect(promises.map((p) => p.status)).toEqual(["PENDING"]);
  });

  test("the same result when call_record.sealed arrives before call.ended", async () => {
    const { client, portfolioId } = await newVoiceWorkspace("voz-orden");
    const template = await createVoiceAiTemplate(client);
    const phone = uniquePhone();
    const accountId = await addAccount(client, portfolioId, phone);

    const { callRef } = await scriptPromiseCall(client, {
      portfolioAccountId: accountId,
      phone,
      agentTemplateId: template.id,
      order: ["call_record.sealed", "call.ended"]
    });

    // call.ended may land after the decision: wait for delivery too.
    const gestion = await waitForGestion(client, callRef, (g) => g.delivery === "DELIVERED");
    expect(gestion).toMatchObject({
      agentType: "VOICE_AI",
      delivery: "DELIVERED",
      path: "ENGAGED",
      outcome: "PAYMENT_PROMISE"
    });
    const promises = await promisesFor(client, accountId);
    expect(promises.map((p) => p.status)).toEqual(["PENDING"]);
  });

  test("a redelivered call_record.sealed records no second promise", async () => {
    const { client, portfolioId } = await newVoiceWorkspace("voz-reenvio");
    const template = await createVoiceAiTemplate(client);
    const phone = uniquePhone();
    const accountId = await addAccount(client, portfolioId, phone);

    const { callRef } = await scriptPromiseCall(client, {
      portfolioAccountId: accountId,
      phone,
      agentTemplateId: template.id
    });

    const [call] = await callsTo(phone);
    const sealed = call.deliveries.find((d) => d.type === "call_record.sealed");
    expect(sealed).toBeDefined();
    const redelivery = await redeliverEvent(callRef, sealed!.eventId);
    expect(redelivery.status).toBe(200);

    // Any decision a redelivery triggered would run after its response: give it the time one
    // takes, then count.
    await new Promise((r) => setTimeout(r, 3000));
    const promises = await promisesFor(client, accountId);
    expect(promises).toHaveLength(1);
  });

  test("a busy call fails with BUSY and records no promise", async () => {
    const { client, portfolioId } = await newVoiceWorkspace("voz-ocupado");
    const template = await createVoiceAiTemplate(client);
    const phone = uniquePhone();
    const accountId = await addAccount(client, portfolioId, phone);

    await scriptCall(phone, { outcome: "busy" });
    const { providerRef: callRef } = await client.trpc.outreach.dispatch.mutate({
      portfolioAccountId: accountId,
      agentTemplateId: template.id
    });
    await completeCall(callRef);

    const gestion = await waitForGestion(client, callRef, (g) => g.delivery !== "DISPATCHED");
    expect(gestion).toMatchObject({ delivery: "FAILED", deliveryReason: "BUSY" });
    // The failed call's record has no spoken turns, so no decision follows.
    await waitFor(
      () => promisesFor(client, accountId),
      (p) => p.length === 0,
      (p) => `${p.length} promise(s)`
    );
    expect(await promisesFor(client, accountId)).toHaveLength(0);
  });
});
