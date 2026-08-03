import type { CreateTRPCClient } from "@trpc/client";
import type { AppRouter } from "@qcobro/apiserver";
import { evaluateInputSchema, type EvalEvent } from "@qcobro/common";
import { parse } from "../validate.js";

type RouterClient = CreateTRPCClient<AppRouter>;
type AgentEvaluations = RouterClient["agentEvaluations"];
type EvaluateInput = Parameters<AgentEvaluations["evaluate"]["subscribe"]>[0];

/**
 * Agent evaluation operations.
 *
 * `evaluate` starts a streaming evaluation of a `VOICE_AI`, `EMAIL`, or `WHATSAPP` agent —
 * either an existing template by id (with caller-supplied scenarios) or a YAML eval
 * template (agent definition + its own embedded scenarios, never persisted) — and returns
 * an async iterable of events, consumed with `for await`. It is distinct from and unrelated
 * to `@qcobro/common`'s `evaluate(events, parameters)` (the `engine-scorecard` capability),
 * which judges dispatch/engine behavior, not agent conversation logic.
 *
 * Streams over the `realtime-streaming` WebSocket transport (`/trpc-ws`), the same one the
 * webapp's Gestiones list uses — tRPC's callback-based `.subscribe` is adapted into an
 * async generator here so callers never touch that transport directly.
 *
 * Obtain an instance via `client.agentEvaluations`; do not construct it directly.
 */
export class AgentEvaluationsResource {
  readonly #trpc: RouterClient;

  /** @internal */
  constructor(trpc: RouterClient) {
    this.#trpc = trpc;
  }

  async *evaluate(input: EvaluateInput): AsyncGenerator<EvalEvent> {
    const parsed = parse(evaluateInputSchema, input) as EvaluateInput;

    const queue: EvalEvent[] = [];
    let waiter: (() => void) | null = null;
    let done = false;
    let failure: unknown = null;

    const wake = () => {
      const resolve = waiter;
      waiter = null;
      resolve?.();
    };

    const subscription = this.#trpc.agentEvaluations.evaluate.subscribe(parsed, {
      onData: (event) => {
        queue.push(event as EvalEvent);
        wake();
      },
      onError: (err) => {
        failure = err;
        done = true;
        wake();
      },
      onComplete: () => {
        done = true;
        wake();
      }
    });

    try {
      for (;;) {
        if (queue.length > 0) {
          yield queue.shift() as EvalEvent;
          continue;
        }
        if (done) {
          if (failure) throw failure;
          return;
        }
        await new Promise<void>((resolve) => {
          waiter = resolve;
        });
      }
    } finally {
      subscription.unsubscribe();
    }
  }
}
