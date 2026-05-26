export type LLMVendor = "anthropic" | "openai" | "google";

export interface AgentConfig {
  vendor: LLMVendor;
  model: string;
  temperature?: number;
}

export interface AgentResult {
  success: boolean;
  resultado: "CONTACTADO" | "NO_CONTACTADO" | "PROMESA" | "RECHAZO";
  notas?: string;
  montoPropuesto?: number;
}
