import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable } from "../components/ui/data-table.js";
import { FilterSelect } from "../components/ui/select.js";
import { Badge } from "../components/ui/badge.js";

const PAGE_SIZE = 50;

const OUTCOMES = [
  "NO_ANSWER",
  "PAYMENT_PROMISE",
  "PARTIAL_PAYMENT_AGREED",
  "CALLBACK_REQUESTED",
  "RESOLVED",
  "PAID",
  "WRONG_NUMBER",
  "OPT_OUT",
  "REFUSED",
  "OTHER"
] as const;

const AGENT_TYPES = ["VOICE_AI", "VOICE_PRERECORDED", "SMS", "EMAIL", "WHATSAPP"] as const;

function outcomeVariant(outcome: string) {
  if (["RESOLVED", "PAID", "PAYMENT_PROMISE", "PARTIAL_PAYMENT_AGREED"].includes(outcome))
    return "success";
  if (["WRONG_NUMBER", "OPT_OUT", "REFUSED"].includes(outcome)) return "destructive";
  if (outcome === "CALLBACK_REQUESTED") return "orange";
  return "secondary";
}

export function Gestiones() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [outcome, setOutcome] = useState("");
  const [agentType, setAgentType] = useState("");
  const [page, setPage] = useState(1);

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
        onRowClick={(row) => navigate(`/gestiones/${row.id}`)}
        columns={[
          {
            key: "portfolioAccount",
            header: t("gestiones.col.debtor"),
            render: (r) => (r.portfolioAccount as { fullName: string } | undefined)?.fullName ?? "—"
          },
          {
            key: "outcome",
            header: t("gestiones.col.result"),
            render: (r) => (
              <Badge variant={outcomeVariant(r.outcome as string)}>
                {t(`gestiones.outcome.${r.outcome}` as Parameters<typeof t>[0])}
              </Badge>
            )
          },
          {
            key: "agentType",
            header: t("gestiones.col.agent"),
            render: (r) => t(`agents.type.${r.agentType}` as Parameters<typeof t>[0])
          },
          {
            key: "campaign",
            header: t("gestiones.col.campaign"),
            render: (r) => (r.campaign as { name: string } | null)?.name ?? "—"
          },
          {
            key: "debtAmountSnapshot",
            header: t("gestiones.col.amount"),
            render: (r) =>
              r.debtAmountSnapshot != null
                ? new Intl.NumberFormat("es", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0
                  }).format(r.debtAmountSnapshot as number)
                : "—"
          },
          {
            key: "contactedAt",
            header: t("gestiones.col.date"),
            render: (r) => new Date(r.contactedAt as string).toLocaleString()
          }
        ]}
      />
    </div>
  );
}
