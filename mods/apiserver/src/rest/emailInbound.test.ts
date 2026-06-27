import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripQuotedReply } from "./emailInbound.js";

describe("stripQuotedReply", () => {
  it("keeps only the new message above a Gmail-style quote + signature", () => {
    const raw = [
      "Pago mañana.",
      "",
      "",
      "--",
      "Pedro",
      "",
      "",
      "On Sat, Jun 27, 2026 at 6:21 PM QCobro <cobranza@notices.qcobro.com> wrote:",
      "",
      "> Estimado Pedro Sanders,",
      "> Este es un correo de prueba."
    ].join("\n");
    assert.equal(stripQuotedReply(raw), "Pago mañana.");
  });

  it("cuts at a Spanish 'El … escribió:' marker", () => {
    const raw = [
      "Puedo pagar el viernes.",
      "",
      "El sáb, 27 jun 2026 a las 18:21, QCobro escribió:",
      "> Estimado cliente"
    ].join("\n");
    assert.equal(stripQuotedReply(raw), "Puedo pagar el viernes.");
  });

  it("cuts at an Outlook 'From:' header block", () => {
    const raw = ["Confirmo el pago.", "", "From: QCobro", "Sent: Saturday", "Subject: Re"].join(
      "\n"
    );
    assert.equal(stripQuotedReply(raw), "Confirmo el pago.");
  });

  it("returns a clean single-line message unchanged", () => {
    assert.equal(stripQuotedReply("No puedo pagar este mes."), "No puedo pagar este mes.");
  });

  it("falls back to the full text when stripping would leave nothing", () => {
    const quotedOnly = ["> Estimado cliente,", "> su saldo está pendiente."].join("\n");
    assert.equal(stripQuotedReply(quotedOnly), quotedOnly.trim());
  });
});
