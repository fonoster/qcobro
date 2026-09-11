import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildThreadWithOpener } from "./threads.js";
import type { EmailThreadMessage } from "../types/email.js";

const reply: EmailThreadMessage = {
  direction: "inbound",
  from: "cliente@example.com",
  at: "2026-09-11T10:00:00.000Z",
  body: "¿De qué trata esto?"
};

describe("buildThreadWithOpener", () => {
  it("leads with the dispatched notice as an outbound turn", () => {
    const thread = buildThreadWithOpener(
      { from: "cobranza@qcobro.com", to: "cliente@example.com", messageBody: "Su saldo es 9,500." },
      [reply]
    );

    assert.equal(thread.length, 2);
    assert.deepEqual(thread[0], {
      direction: "outbound",
      from: "cobranza@qcobro.com",
      at: "",
      body: "Su saldo es 9,500."
    });
    assert.equal(thread[1], reply);
  });

  it("carries the notice subject when dispatch stored one", () => {
    const thread = buildThreadWithOpener(
      { messageBody: "Su saldo es 9,500.", subject: "Recordatorio de pago" },
      [reply]
    );

    assert.equal(thread[0].subject, "Recordatorio de pago");
  });

  it("omits subject rather than emitting an empty one", () => {
    const thread = buildThreadWithOpener({ messageBody: "Su saldo es 9,500.", subject: "" }, []);

    assert.equal("subject" in thread[0], false);
  });

  it("falls back to a generic sender when channelData has no from", () => {
    const thread = buildThreadWithOpener({ messageBody: "Su saldo es 9,500." }, []);

    assert.equal(thread[0].from, "agent");
  });

  it("returns the thread untouched when there is no notice to add", () => {
    const messages = [reply];

    assert.equal(buildThreadWithOpener({ from: "cobranza@qcobro.com" }, messages), messages);
    assert.equal(buildThreadWithOpener({ messageBody: "" }, messages), messages);
    assert.equal(buildThreadWithOpener(null, messages), messages);
    assert.equal(buildThreadWithOpener(undefined, messages), messages);
  });

  it("ignores non-string channelData fields instead of throwing", () => {
    const thread = buildThreadWithOpener({ messageBody: 42, subject: {}, from: [] }, [reply]);

    assert.deepEqual(thread, [reply]);
  });

  it("does not mutate the thread it is given", () => {
    const messages = [reply];
    buildThreadWithOpener({ messageBody: "Su saldo es 9,500." }, messages);

    assert.equal(messages.length, 1);
  });
});
