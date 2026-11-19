import type { RecoveryKind, RecoveryListItem } from "@qcobro/common";
import { useI18n, type MessageId } from "../../lib/i18n.js";
import { FilterSelect } from "../ui/select.js";
import { Pagination } from "../ui/pagination.js";

export const RECOVERY_KINDS: RecoveryKind[] = ["PARTIAL", "CAUGHT_UP", "PAID_OFF"];
export type GestionFilter = "all" | "with" | "without";
/** A list item as it arrives over the wire: dates may be ISO strings. */
export type RecoveryListRow = Omit<RecoveryListItem, "detectedAt" | "previousSyncAt"> & {
  detectedAt: Date | string;
};
const GESTION_FILTERS: GestionFilter[] = ["all", "with", "without"];

type Translate = ReturnType<typeof useI18n>["t"];

/** `C-1042 · Voz IA · hace 2 días`, or `C-0877 · Sin gestión` when nobody reached the account. */
function gestionLine(t: Translate, item: RecoveryListRow): string {
  const last = item.context.lastTouch;
  if (!last) return `${item.externalId} · ${t("portfolios.recovery.list.noGestion")}`;
  const days = item.context.daysSinceLastTouch ?? 0;
  const ago =
    days === 0
      ? t("portfolios.recovery.list.daysAgo.zero")
      : days === 1
        ? t("portfolios.recovery.list.daysAgo.one")
        : t("portfolios.recovery.list.daysAgo.other").replace("{count}", days.toLocaleString());
  return `${item.externalId} · ${t(`agents.type.${last.agentType}` as MessageId)} · ${ago}`;
}

function kindLine(t: Translate, item: RecoveryListRow): string {
  const kind = t(`portfolios.recovery.list.kind.${item.kind}` as MessageId);
  return item.installments === 1
    ? t("portfolios.recovery.list.installments.one").replace("{kind}", kind)
    : t("portfolios.recovery.list.installments.other")
        .replace("{kind}", kind)
        .replace("{count}", item.installments.toLocaleString());
}

export interface RecoveryListCardProps {
  items: RecoveryListRow[];
  kind: RecoveryKind | "all";
  onKindChange: (kind: RecoveryKind | "all") => void;
  gestion: GestionFilter;
  onGestionChange: (gestion: GestionFilter) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  money: (value: number) => string;
  /** Formats the detection date (`12 nov`) in the workspace's timezone. */
  formatDate: (date: Date | string) => string;
}

/** The recoveries detected in the period, newest first, with what was happening before each. */
export function RecoveryListCard({
  items,
  kind,
  onKindChange,
  gestion,
  onGestionChange,
  page,
  totalPages,
  onPageChange,
  money,
  formatDate
}: RecoveryListCardProps) {
  const { t } = useI18n();
  const title = t("portfolios.recovery.list.title");

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        <div className="flex gap-2">
          <FilterSelect
            aria-label={t("portfolios.recovery.list.kindAriaLabel")}
            value={kind}
            onChange={(e) => onKindChange(e.target.value as RecoveryKind | "all")}
            className="h-8 rounded-full text-[13px] text-fg"
          >
            <option value="all">{t("portfolios.recovery.list.kind.all")}</option>
            {RECOVERY_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`portfolios.recovery.list.kind.${k}` as MessageId)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            aria-label={t("portfolios.recovery.list.gestionAriaLabel")}
            value={gestion}
            onChange={(e) => onGestionChange(e.target.value as GestionFilter)}
            className="h-8 rounded-full text-[13px] text-fg"
          >
            {GESTION_FILTERS.map((g) => (
              <option key={g} value={g}>
                {t(`portfolios.recovery.list.gestion.${g}` as MessageId)}
              </option>
            ))}
          </FilterSelect>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-subtle">
          {t("portfolios.recovery.emptyPeriod")}
        </p>
      ) : (
        <ul aria-label={title} className="flex flex-col">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-fg">{item.fullName}</span>
                <span className="truncate text-xs text-fg-subtle">{gestionLine(t, item)}</span>
              </div>
              <span className="w-[150px] shrink-0 text-xs text-fg-subtle">{kindLine(t, item)}</span>
              <span className="shrink-0 text-right text-sm text-fg">{money(item.amount)}</span>
              <span className="w-14 shrink-0 text-right text-xs text-fg-subtle">
                {formatDate(item.detectedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          className="self-end"
        />
      )}
    </div>
  );
}
