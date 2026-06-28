import { trpc } from "./trpc.js";

/** The active workspace's display currency (defaults to USD while loading/unset). */
export function useWorkspaceCurrency(): string {
  const q = trpc.workspaceSettings.get.useQuery();
  return q.data?.currency ?? "USD";
}
