import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { campaignStatusTransitions, type CampaignStatus } from "@qcobro/common";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { PageHeader } from "../components/page-header.js";
import { SectionCard } from "../components/section-card.js";
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";
import { humanizeDays } from "../lib/campaignDays.js";

function statusVariant(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "PAUSED") return "orange";
  if (status === "COMPLETED") return "violet";
  return "secondary";
}

const STATUS_ACTION: Record<CampaignStatus, string> = {
  ACTIVE: "campaigns.actions.activate",
  PAUSED: "campaigns.actions.pause",
  COMPLETED: "campaigns.actions.complete",
  ARCHIVED: "campaigns.actions.archive"
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const query = trpc.campaigns.get.useQuery({ id: id! });
  const updateStatus = trpc.campaigns.updateStatus.useMutation({
    onSuccess: () => utils.campaigns.get.invalidate({ id: id! })
  });

  const c = query.data as
    | {
        id: string;
        name: string;
        status: CampaignStatus;
        startDate: string;
        endDate: string | null;
        daysOfWeek: number[];
        startTime: string;
        endTime: string;
        maxAttemptsPerAccount: number;
        maxAttemptsPerDay: number;
        agentTemplate: { id: string; name: string; type: string } | null;
        triggers: { id: string; type: string; config: Record<string, unknown> }[];
        portfolios: { portfolio: { id: string; name: string } }[];
      }
    | undefined;

  const transitions = c ? campaignStatusTransitions[c.status] : [];
  const primary: CampaignStatus | undefined = transitions.includes("ACTIVE")
    ? "ACTIVE"
    : transitions.includes("PAUSED")
      ? "PAUSED"
      : undefined;
  const menuItems = transitions
    .filter((s) => s !== primary)
    .map((s) => ({
      label: t(STATUS_ACTION[s] as Parameters<typeof t>[0]),
      onClick: () => c && updateStatus.mutate({ id: c.id, status: s })
    }));

  const dateLabel = c
    ? `${new Date(c.startDate).toLocaleDateString()} – ${
        c.endDate ? new Date(c.endDate).toLocaleDateString() : "—"
      }`
    : "";

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
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(c.status)}>
                {t(`campaigns.status.${c.status}` as Parameters<typeof t>[0])}
              </Badge>
              {primary && (
                <Button
                  size="sm"
                  variant={primary === "ACTIVE" ? "default" : "outline"}
                  onClick={() => updateStatus.mutate({ id: c.id, status: primary })}
                >
                  {t(STATUS_ACTION[primary] as Parameters<typeof t>[0])}
                </Button>
              )}
              {menuItems.length > 0 && <RowActionsMenu items={menuItems} />}
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-6">
        <SectionCard title={t("campaigns.title")}>
          {c && (
            <div className="flex flex-col">
              <Row label={t("campaigns.detail.agent")} value={c.agentTemplate?.name ?? "—"} />
              <Row label={t("campaigns.detail.days")} value={humanizeDays(c.daysOfWeek ?? [], t)} />
              <Row label={t("campaigns.detail.schedule")} value={`${c.startTime}–${c.endTime}`} />
              <Row label={t("campaigns.detail.dates")} value={dateLabel} />
              <Row
                label={t("campaigns.detail.caps")}
                value={`${c.maxAttemptsPerAccount} · ${c.maxAttemptsPerDay}`}
              />
            </div>
          )}
        </SectionCard>

        <div className="flex flex-col gap-6">
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
      </div>
    </div>
  );
}
