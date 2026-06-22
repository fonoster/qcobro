import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { DataTable } from "../components/ui/data-table.js";
import { PageHeader } from "../components/page-header.js";
import { SectionCard } from "../components/section-card.js";
import { KpiRow } from "../components/kpi-card.js";

function outcomeVariant(outcome: string) {
  if (["RESOLVED", "PAID", "PAYMENT_PROMISE", "PARTIAL_PAYMENT_AGREED"].includes(outcome))
    return "success";
  if (["WRONG_NUMBER", "OPT_OUT", "REFUSED"].includes(outcome)) return "destructive";
  if (outcome === "CALLBACK_REQUESTED") return "orange";
  return "secondary";
}

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();

  const query = trpc.campaigns.get.useQuery({ id: id! });
  const c = query.data as
    | {
        id: string;
        name: string;
        status: string;
        startDate: string;
        endDate: string | null;
        startTime: string;
        endTime: string;
        agentTemplate: { id: string; name: string; type: string } | null;
        triggers: { id: string; type: string; config: Record<string, unknown> }[];
        portfolios: { portfolio: { id: string; name: string } }[];
        contactLogs: {
          id: string;
          outcome: string;
          agentType: string;
          debtAmountSnapshot: number | null;
          contactedAt: string;
          portfolioAccount: { fullName: string };
        }[];
      }
    | undefined;

  const logs = c?.contactLogs ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("campaigns.detail.back")}
        </Button>
      </div>

      <PageHeader
        title={c?.name ?? "…"}
        description={c?.agentTemplate?.name}
        action={
          c ? (
            <Badge variant="secondary">
              {t(`campaigns.status.${c.status}` as Parameters<typeof t>[0])}
            </Badge>
          ) : undefined
        }
      />

      {c && (
        <KpiRow
          cards={[
            { label: t("campaigns.kpi.accounts"), value: "—" },
            { label: t("campaigns.kpi.calls"), value: logs.length.toLocaleString() },
            {
              label: t("campaigns.detail.schedule"),
              value: `${c.startTime}–${c.endTime}`,
              subtext: new Date(c.startDate).toLocaleDateString()
            },
            {
              label: t("campaigns.col.status"),
              value: t(`campaigns.status.${c.status}` as Parameters<typeof t>[0])
            }
          ]}
        />
      )}

      <div className="grid grid-cols-2 gap-6">
        <SectionCard title={t("campaigns.detail.portfolios")}>
          <ul className="flex flex-col gap-1">
            {(c?.portfolios ?? []).map((p) => (
              <li key={p.portfolio.id} className="text-sm text-slate-700">
                {p.portfolio.name}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t("campaigns.detail.triggers")}>
          {c && c.triggers.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {c.triggers.map((trg) => (
                <li key={trg.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{trg.type}</span>
                  <span className="text-xs text-slate-400">{JSON.stringify(trg.config)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">{t("campaigns.detail.noTriggers")}</p>
          )}
        </SectionCard>
      </div>

      <SectionCard title={t("campaigns.detail.gestiones")}>
        {logs.length > 0 ? (
          <DataTable
            data={logs as unknown as Record<string, unknown>[]}
            keyField="id"
            searchable={false}
            onRowClick={(row) => navigate(`/gestiones/${row.id}`)}
            columns={[
              {
                key: "portfolioAccount",
                header: t("gestiones.col.debtor"),
                render: (r) =>
                  (r.portfolioAccount as { fullName: string } | undefined)?.fullName ?? "—"
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
        ) : (
          <p className="text-sm text-slate-500">{t("campaigns.detail.noGestiones")}</p>
        )}
      </SectionCard>
    </div>
  );
}
