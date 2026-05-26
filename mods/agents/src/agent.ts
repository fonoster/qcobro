import type { AgentConfig, AgentResult } from "./types.js";

export async function createAgent(config: AgentConfig) {
  const { vendor, model, temperature = 0.3 } = config;

  async function run(context: Record<string, unknown>): Promise<AgentResult> {
    // LLM invocation is wired in per-vendor below; stub returns pending.
    void vendor;
    void model;
    void temperature;
    void context;
    return { success: false, resultado: "NO_CONTACTADO" };
  }

  return { run };
}
