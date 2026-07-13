/** Wraps a value as a successful MCP tool result (JSON-serialized text content). */
export function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

/** Wraps a caught error as a failed MCP tool result instead of throwing it. */
export function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** Runs a tool handler, converting thrown errors into a structured MCP error result. */
export function runTool<T>(fn: () => Promise<T>) {
  return fn().then(textResult).catch(errorResult);
}
