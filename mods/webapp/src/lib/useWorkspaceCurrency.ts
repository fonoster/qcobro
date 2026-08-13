import { DEFAULT_LOCALE, type Locale } from "@qcobro/common";
import { trpc } from "./trpc.js";

/** The active workspace's display currency (defaults to USD while loading/unset). */
export function useWorkspaceCurrency(): string {
  const q = trpc.workspaceSettings.get.useQuery();
  return q.data?.currency ?? "USD";
}

/**
 * The active workspace's number-formatting locale (defaults while loading/unset).
 *
 * The reach-out preview renders templates client-side, so it has to format amounts the same
 * way the server will — otherwise an operator previews `9,500` and sends something else.
 */
export function useWorkspaceLocale(): Locale {
  const q = trpc.workspaceSettings.get.useQuery();
  return (q.data?.locale as Locale | undefined) ?? DEFAULT_LOCALE;
}
