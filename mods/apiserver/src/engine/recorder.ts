import { randomUUID } from "node:crypto";
import type { Clock, EngineEvent, EngineEventInput } from "@qcobro/common";

export type { EngineEventInput };

export interface TickRecorder {
  tickId: string;
  emit(input: EngineEventInput): void;
  events(): EngineEvent[];
}

/**
 * Collects one tick's flight-recorder events in memory. Timestamps come from the
 * engine's injected clock (deterministic under test); ids are `<tickId>#<seq>` so
 * they are unique, ordered, and idempotent on re-flush (`skipDuplicates`).
 */
export function createTickRecorder(clock: Clock, tickId: string = randomUUID()): TickRecorder {
  const collected: EngineEvent[] = [];
  let seq = 0;

  return {
    tickId,
    emit(input) {
      seq += 1;
      collected.push({
        ...input,
        id: `${tickId}#${seq}`,
        at: clock.now().toISOString(),
        tickId,
        seq
      } as EngineEvent);
    },
    events() {
      return collected;
    }
  };
}
