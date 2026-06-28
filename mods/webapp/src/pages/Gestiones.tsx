import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable, TableCellStack } from "../components/ui/data-table.js";
import { FilterSelect } from "../components/ui/select.js";
import { SlideOver } from "../components/ui/slide-over.js";
import { GestionDetailContent } from "./GestionDetail.js";
import { formatRelativeDate } from "../lib/relativeDate.js";
import { PhoneCall, Voicemail, MessageSquare, Mail, MessageCircle } from "lucide-react";

const PAGE_SIZE = 50;

const CHANNEL_ICON: Record<string, typeof MessageSquare> = {
  VOICE_AI: PhoneCall,
  VOICE_PRERECORDED: Voicemail,
  SMS: MessageSquare,
  EMAIL: Mail,
  WHATSAPP: MessageCircle
};

const OUTCOMES = [
  "DELIVERED",
  "NOT_DELIVERED",
  "NO_ANSWER",
  "PAYMENT_PROMISE",
  "PARTIAL_PAYMENT_AGREED",
  "NEW_TERMS",
  "CALLBACK_REQUESTED",
  "DISPUTE_RAISED",
  "INFORMATION_REQUEST",
  "RESOLVED",
  "PAID",
  "WRONG_NUMBER",
  "OPT_OUT",
  "REFUSED",
  "OTHER"
] as const;

const AGENT_TYPES = ["VOICE_AI", "VOICE_PRERECORDED", "SMS", "EMAIL"] as const;

export function Gestiones() {
  const { t, language } = useI18n();

  const [outcome, setOutcome] = useState("");
  const [agentType, setAgentType] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data } = trpc.campaigns.contactLog.list.useQuery({
    outcome: (outcome || undefined) as (typeof OUTCOMES)[number] | undefined,
    agentType: (agentType || undefined) as (typeof AGENT_TYPES)[number] | undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("gestiones.title")} description={t("gestiones.description")} />

      <DataTable
        data={items as unknown as Record<string, unknown>[]}
        keyField="id"
        searchable={false}
        filterElement={
          <div className="flex gap-2">
            <FilterSelect value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="">{t("gestiones.filter.allOutcomes")}</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {t(`gestiones.outcome.${o}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={agentType} onChange={(e) => setAgentType(e.target.value)}>
              <option value="">{t("gestiones.filter.allAgents")}</option>
              {AGENT_TYPES.map((a) => (
                <option key={a} value={a}>
                  {t(`agents.type.${a}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </FilterSelect>
          </div>
        }
        page={page}
        totalPages={totalPages}
        totalRecords={total}
        onPageChange={setPage}
        onRowClick={(row) => setSelectedId(row.id as string)}
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
            render: (r) => {
              const Icon = CHANNEL_ICON[r.agentType as string] ?? MessageSquare;
              return (
                <span className="inline-flex items-center gap-2 text-slate-700">
                  <Icon className="h-4 w-4 text-slate-400" />
                  {t(`agents.type.${r.agentType}` as Parameters<typeof t>[0])}
                </span>
              );
            }
          },
          {
            key: "outcome",
            header: t("gestiones.col.result"),
            render: (r) => (
              <span className="text-slate-700">
                {t(`gestiones.outcome.${r.outcome}` as Parameters<typeof t>[0])}
              </span>
            )
          },
          {
            key: "aiSummary",
            header: t("gestiones.col.summary"),
            render: (r) => (
              <span className="line-clamp-2 max-w-md text-sm text-slate-600">
                {(r.aiSummary as string | null) || ""}
              </span>
            )
          },
          {
            key: "contactedAt",
            header: t("gestiones.col.date"),
            render: (r) => (
              <span
                className="whitespace-nowrap text-slate-600"
                title={new Date(r.contactedAt as string).toLocaleString()}
              >
                {formatRelativeDate(r.contactedAt as string, language)}
              </span>
            )
          }
        ]}
      />

      <SlideOver open={!!selectedId} onClose={() => setSelectedId(null)}>
        {selectedId && <GestionDetailContent id={selectedId} onClose={() => setSelectedId(null)} />}
      </SlideOver>
    </div>
  );
}
