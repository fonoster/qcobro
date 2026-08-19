import { useCallback, useMemo } from "react";
import { createMoneyFormatters, DEFAULT_LOCALE, type Locale } from "@qcobro/common";
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

/**
 * The console's money formatter: workspace currency and locale, cents only when the amount
 * has them. Formatters are memoized on `[locale, currency]` so a table rendering many rows
 * reuses one `Intl.NumberFormat` pair instead of constructing one per cell.
 */
export function useMoney(): (value: number) => string {
  const currency = useWorkspaceCurrency();
  const locale = useWorkspaceLocale();
  const { integer, fractional } = useMemo(
    () => createMoneyFormatters(locale, currency),
    [locale, currency]
  );
  return useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return "";
      return (Number.isInteger(value) ? integer : fractional).format(value);
    },
    [integer, fractional]
  );
}
