import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, ListChecks } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { useWorkspaceTimezone } from "../lib/useWorkspaceCurrency.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable, TableCellStack } from "../components/ui/data-table.js";
import { FilterChip } from "../components/ui/filter-chip.js";
import { SegmentedControl } from "../components/ui/segmented.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { GestionDrawer } from "./GestionDetail.js";
import { useContactLogRealtime } from "../lib/useContactLogRealtime.js";
import { DELIVERIES, OUTCOMES, deliveryLabel, outcomeLabel } from "../lib/contactAxes.js";
import {
  formatListDate,
  gestionChannelIcon,
  localDayOffset,
  periodBounds,
  resolveTimeZone,
  type GestionPeriod
} from "./gestionFormat.js";

const PAGE_SIZE = 50;

const AGENT_TYPES = ["VOICE_AI", "VOICE_PRERECORDED", "SMS", "EMAIL", "WHATSAPP"] as const;
const PERIODS: GestionPeriod[] = ["today", "7d", "30d", "custom"];

type Key = Parameters<ReturnType<typeof useI18n>["t"]>[0];

/** A channel as the design draws it: icon + label ("Pre-grabada"). */
export function ChannelLabel({ channel }: { channel: string }) {
  const { t } = useI18n();
  const Icon = gestionChannelIcon(channel);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-fg">
      <Icon className="h-4 w-4 shrink-0 text-fg-muted" />
      {t(`gestiones.channel.${channel}` as Key)}
    </span>
  );
}

export function Gestiones() {
  const { t, language } = useI18n();
  const timeZone = resolveTimeZone(useWorkspaceTimezone());
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("gestion");

  // Delivery and outcome filter independently. A single filter mixing "delivered" with
  // "payment promise" is the conflation this model exists to undo.
  const [agentType, setAgentType] = useState("");
  const [delivery, setDelivery] = useState("");
  const [outcome, setOutcome] = useState("");
  const [period, setPeriod] = useState<GestionPeriod>("7d");
  const [custom, setCustom] = useState(() => ({
    from: localDayOffset(7, timeZone),
    to: localDayOffset(0, timeZone)
  }));
  const [page, setPage] = useState(1);

  // Realtime-streaming capability: new/updated gestiones stream in without a manual refresh.
  useContactLogRealtime();

  const bounds = useMemo(() => periodBounds(period, timeZone, custom), [period, timeZone, custom]);

  const { data, isLoading } = trpc.campaigns.contactLog.list.useQuery({
    delivery: (delivery || undefined) as (typeof DELIVERIES)[number] | undefined,
    outcome: (outcome || undefined) as (typeof OUTCOMES)[number] | undefined,
    agentType: (agentType || undefined) as (typeof AGENT_TYPES)[number] | undefined,
    ...bounds,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dateWords = { today: t("gestiones.date.today"), yesterday: t("gestiones.date.yesterday") };

  const open = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("gestion", id);
    else next.delete("gestion");
    setSearchParams(next, { replace: true });
  };
  function resetPage<V>(set: (v: V) => void) {
    return (v: V) => {
      set(v);
      setPage(1);
    };
  }

  const all = t("gestiones.filter.all");
  const filters = (
    <>
      <FilterChip
        label={t("gestiones.filter.channel")}
        value={agentType}
        onChange={resetPage(setAgentType)}
        options={[
          { value: "", label: all },
          ...AGENT_TYPES.map((a) => ({ value: a, label: t(`gestiones.channel.${a}` as Key) }))
        ]}
      />
      <FilterChip
        label={t("gestiones.filter.delivery")}
        value={delivery}
        onChange={resetPage(setDelivery)}
        options={[
          { value: "", label: t("gestiones.filter.allFem") },
          ...DELIVERIES.map((d) => ({ value: d, label: t(`gestiones.delivery.${d}` as Key) }))
        ]}
      />
      <FilterChip
        label={t("gestiones.filter.outcome")}
        value={outcome}
        onChange={resetPage(setOutcome)}
        options={[
          { value: "", label: all },
          ...OUTCOMES.map((o) => ({ value: o, label: t(`gestiones.outcome.${o}` as Key) }))
        ]}
      />
    </>
  );

  const dateInput = (field: "from" | "to") => (
    <input
      type="date"
      aria-label={t(`gestiones.period.${field}` as Key)}
      value={custom[field]}
      onChange={(e) => {
        setCustom((c) => ({ ...c, [field]: e.target.value }));
        setPage(1);
      }}
      className="h-[38px] rounded-control border border-border bg-surface px-3 font-mono text-xs text-fg focus:border-fg focus:outline-none"
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("gestiones.title")}
        description={t("gestiones.description")}
        actions={
          <>
            {period === "custom" && (
              <div className="flex items-center gap-2">
                {dateInput("from")}
                <span className="text-fg-muted">–</span>
                {dateInput("to")}
              </div>
            )}
            <SegmentedControl<GestionPeriod>
              aria-label={t("gestiones.period.label")}
              value={period}
              onChange={resetPage(setPeriod)}
              options={PERIODS.map((p) => ({
                value: p,
                label: t(`gestiones.period.${p}` as Key)
              }))}
            />
          </>
        }
      />

      <DataTable
        data={items as unknown as Record<string, unknown>[]}
        keyField="id"
        searchable={false}
        filters={filters}
        countLabel={t("gestiones.count")}
        itemLabel={t("gestiones.count")}
        page={page}
        pageSize={PAGE_SIZE}
        totalPages={totalPages}
        totalRecords={total}
        onPageChange={setPage}
        onRowClick={(row) => open(row.id as string)}
        empty={
          isLoading ? undefined : (
            <EmptyState
              icon={<ListChecks />}
              title={t("gestiones.empty")}
              body={t("gestiones.emptyBody")}
            />
          )
        }
        columns={[
          {
            key: "portfolioAccount",
            header: t("gestiones.col.debtor"),
            render: (r) => {
              const acc = r.portfolioAccount as
                | { fullName: string; externalId?: string }
                | undefined;
              return <TableCellStack title={acc?.fullName ?? "—"} sub={acc?.externalId} />;
            }
          },
          {
            key: "agentType",
            header: t("gestiones.col.agent"),
            width: 130,
            render: (r) => <ChannelLabel channel={r.agentType as string} />
          },
          {
            key: "delivery",
            header: t("gestiones.col.delivery"),
            width: 180,
            render: (r) =>
              deliveryLabel(
                t,
                r.delivery as string,
                r.deliveryReason as string | null,
                r.agentType as string
              )
          },
          {
            key: "outcome",
            header: t("gestiones.col.result"),
            width: 170,
            // Null for most rows — the sparseness is what makes conversion legible at a glance.
            render: (r) =>
              outcomeLabel(t, r.outcome as string | null) ?? (
                <span className="text-fg-muted">—</span>
              )
          },
          {
            key: "contactedAt",
            header: t("gestiones.col.date"),
            width: 110,
            render: (r) => (
              <span
                className="whitespace-nowrap text-fg-muted"
                title={new Date(r.contactedAt as string).toLocaleString(language)}
              >
                {formatListDate(r.contactedAt as string, language, timeZone, dateWords)}
              </span>
            )
          },
          {
            key: "chevron",
            header: "",
            width: 24,
            align: "right",
            render: () => <ChevronRight aria-hidden className="ml-auto h-3.5 w-3.5 text-fg-muted" />
          }
        ]}
      />

      <GestionDrawer id={selectedId} onClose={() => open(null)} />
    </div>
  );
}
