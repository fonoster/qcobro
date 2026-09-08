import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { VoiceCallStatus } from "@qcobro/common";
import { mapVoiceCallStatusToDeliveryReason } from "./mapVoiceCallStatusToDeliveryReason.js";

describe("mapVoiceCallStatusToDeliveryReason", () => {
  it("maps NO_ANSWER and NO_USER_RESPONSE to NO_ANSWER", () => {
    assert.equal(mapVoiceCallStatusToDeliveryReason("NO_ANSWER"), "NO_ANSWER");
    assert.equal(mapVoiceCallStatusToDeliveryReason("NO_USER_RESPONSE"), "NO_ANSWER");
  });

  it("maps USER_BUSY to BUSY", () => {
    assert.equal(mapVoiceCallStatusToDeliveryReason("USER_BUSY"), "BUSY");
  });

  it("maps CALL_REJECTED and NOT_ACCEPTABLE_HERE to REJECTED", () => {
    assert.equal(mapVoiceCallStatusToDeliveryReason("CALL_REJECTED"), "REJECTED");
    assert.equal(mapVoiceCallStatusToDeliveryReason("NOT_ACCEPTABLE_HERE"), "REJECTED");
  });

  it("maps UNALLOCATED, INVALID_NUMBER_FORMAT, and NO_ROUTE_DESTINATION to INVALID_DESTINATION", () => {
    assert.equal(mapVoiceCallStatusToDeliveryReason("UNALLOCATED"), "INVALID_DESTINATION");
    assert.equal(
      mapVoiceCallStatusToDeliveryReason("INVALID_NUMBER_FORMAT"),
      "INVALID_DESTINATION"
    );
    assert.equal(mapVoiceCallStatusToDeliveryReason("NO_ROUTE_DESTINATION"), "INVALID_DESTINATION");
  });

  it("maps SERVICE_UNAVAILABLE to UNREACHABLE", () => {
    assert.equal(mapVoiceCallStatusToDeliveryReason("SERVICE_UNAVAILABLE"), "UNREACHABLE");
  });

  it("maps NORMAL_CLEARING to OUTCOME_UNKNOWN — the call was fine, our signal is what's missing", () => {
    assert.equal(mapVoiceCallStatusToDeliveryReason("NORMAL_CLEARING"), "OUTCOME_UNKNOWN");
  });

  it("returns null for UNKNOWN — not yet decided, never a guess", () => {
    assert.equal(mapVoiceCallStatusToDeliveryReason("UNKNOWN"), null);
  });

  it("returns null for a status this codebase does not recognize", () => {
    assert.equal(mapVoiceCallStatusToDeliveryReason("SOMETHING_NEW" as VoiceCallStatus), null);
  });
});
