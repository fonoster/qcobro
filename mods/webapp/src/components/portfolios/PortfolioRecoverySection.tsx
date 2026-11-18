import { useMemo, useState } from "react";
import { skipToken } from "@tanstack/react-query";
import {
  RECOVERY_PERIODS,
  recoveryPeriodRange,
  type RecoveryKind,
  type RecoveryPeriod
} from "@qcobro/common";
import { trpc } from "../../lib/trpc.js";
import { useI18n, type MessageId } from "../../lib/i18n.js";
import { useMoney, useWorkspaceTimezone } from "../../lib/useWorkspaceCurrency.js";
import { KpiCard } from "../kpi-card.js";
import { RecoveryBreakdownCard, type RecoveryDimension } from "./RecoveryBreakdownCard.js";
import { RecoveryListCard, type GestionFilter } from "./RecoveryListCard.js";

const PAGE_SIZE = 50;

/**
 * Recuperación on the portfolio detail page: Recuperado and the payments without a recent
 * gestión for the chosen period, then the breakdown and the recoveries themselves. Exits are
 * never shown here: classifying them is API-only.
 */
export function PortfolioRecoverySection({ portfolioId }: { portfolioId: string }) {
  const { t, language } = useI18n();
  const money = useMoney();
  const timeZone = useWorkspaceTimezone();
  const [period, setPeriod] = useState<RecoveryPeriod>("thisMonth");
  const [by, setBy] = useState<RecoveryDimension>("DAYS_SINCE_TOUCH");
  const [kind, setKind] = useState<RecoveryKind | "all">("all");
  const [gestion, setGestion] = useState<GestionFilter>("all");
  const [page, setPage] = useState(1);

  // Dates come from the workspace's timezone, so nothing is fetched until it has loaded.
  const range = timeZone ? recoveryPeriodRange(period, timeZone) : undefined;
  const scope = range ? { ...range, portfolioId } : undefined;
  const summary = trpc.recovery.summary.useQuery(scope ?? skipToken);
  const breakdown = trpc.recovery.breakdown.useQuery(scope ? { ...scope, by } : skipToken);
  const list = trpc.recovery.list.useQuery(
    scope
      ? {
          ...scope,
          ...(kind !== "all" ? { kind } : {}),
          ...(gestion !== "all" ? { hasGestion: gestion === "with" } : {}),
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE
        }
      : skipToken
  );

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(language, { day: "numeric", month: "short", timeZone }),
    [language, timeZone]
  );

  const accounts = (count: number) =>
    count === 1
      ? t("portfolios.recovery.accounts.one")
      : t("portfolios.recovery.accounts.other").replace("{count}", count.toLocaleString());

  const s = summary.data;
  const empty = !s || (s.count === 0 && s.withoutGestionCount === 0);
  const recoveredMeta = empty
    ? t("portfolios.recovery.empty")
    : s.count === 1
      ? t("portfolios.recovery.withGestion.one")
      : t("portfolios.recovery.withGestion.other").replace("{count}", s.count.toLocaleString());

  const resetPage =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  return (
    <section aria-label={t("portfolios.recovery.title")} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <KpiCard
          label={t("portfolios.recovery.recovered")}
          value={empty ? t("portfolios.recovery.emptyValue") : money(s.recovered)}
          subtext={recoveredMeta}
          period={{
            value: period,
            onChange: (value) => resetPage(setPeriod)(value as RecoveryPeriod),
            ariaLabel: t("portfolios.recovery.periodAriaLabel"),
            options: RECOVERY_PERIODS.map((p) => ({
              value: p,
              label: t(`portfolios.recovery.period.${p}` as MessageId)
            }))
          }}
          className="rounded-xl"
        />
        {s && s.withoutGestionCount > 0 && (
          <KpiCard
            label={t("portfolios.recovery.withoutGestion")}
            value={money(s.withoutGestion)}
            subtext={accounts(s.withoutGestionCount)}
            className="rounded-xl"
          />
        )}
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        <RecoveryBreakdownCard by={by} onByChange={setBy} data={breakdown.data} money={money} />
        <RecoveryListCard
          items={list.data?.items ?? []}
          kind={kind}
          onKindChange={resetPage(setKind)}
          gestion={gestion}
          onGestionChange={resetPage(setGestion)}
          page={page}
          totalPages={Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE))}
          onPageChange={setPage}
          money={money}
          formatDate={(date) => dateFormat.format(new Date(date))}
        />
      </div>
    </section>
  );
}
