import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { Megaphone, Pause, Pencil, Play } from "lucide-react";
import {
  campaignStatusTransitions,
  type CampaignPauseReason,
  type CampaignStatus
} from "@qcobro/common";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { DetailHeader } from "../components/detail-header.js";
import { Breadcrumb } from "../components/ui/breadcrumb.js";
import { SectionCard } from "../components/section-card.js";
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";
import { CampaignAutopausedBanner } from "../components/CampaignAutopausedBanner.js";
import { humanizeDays } from "../lib/campaignDays.js";
import { useWorkspaceTimezone } from "../lib/useWorkspaceCurrency.js";
import { formatDmy, formatNextRun, nextRun, timeZoneCity, toYmd } from "../lib/campaignSchedule.js";
import { EditCampaignDrawer, agentLabel } from "../components/campaigns/CampaignFormDrawer.js";

type Translate = ReturnType<typeof useI18n>["t"];

const STATUS_ACTION: Record<CampaignStatus, string> = {
  ACTIVE: "campaigns.actions.activate",
  PAUSED: "campaigns.actions.pause",
  COMPLETED: "campaigns.actions.complete",
  ARCHIVED: "campaigns.actions.archive"
};

type Trigger = { id: string; type: string; config: Record<string, unknown> };

/** A panel (card radius 12, padding 20, gap 16): title 14/500 and muted text on the right. */
function Panel({
  title,
  right,
  className,
  children
}: {
  title: string;
  right?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <SectionCard className={`gap-4 rounded-card p-5 shadow-none ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        {right && <span className="text-xs text-fg-muted">{right}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </SectionCard>
  );
}

function KeyValues({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="flex flex-col gap-3">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 text-[13px]">
          <dt className="text-fg-muted">{k}</dt>
          <dd className="text-right text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function num(triggers: Trigger[], type: string, key: string, fallback: number): number {
  const v = triggers.find((x) => x.type === type)?.config?.[key];
  return typeof v === "number" ? v : fallback;
}

/**
 * The suppression rules the engine applies to every campaign, in plain language. Trigger rows
 * only override their numbers (the engine's defaults otherwise), so the list is the same for
 * every campaign; a DNC_CHECK row adds the do-not-contact rule.
 */
function triggerRules(c: { maxAttemptsPerDay: number; triggers: Trigger[] }, t: Translate) {
  const n = c.maxAttemptsPerDay;
  const rules: { name: string; rule: string; scope: string }[] = [
    {
      name: t("campaigns.trigger.maxPerDay.name"),
      rule:
        n === 1
          ? t("campaigns.trigger.maxPerDay.one")
          : t("campaigns.trigger.maxPerDay.many").replace("{n}", String(n)),
      scope: t("campaigns.trigger.scope.campaign")
    },
    {
      name: t("campaigns.trigger.promise.name"),
      rule: t("campaigns.trigger.promise.rule").replace(
        "{n}",
        String(num(c.triggers, "PAYMENT_PROMISE", "suppressDays", 7))
      ),
      scope: t("campaigns.trigger.scope.account")
    },
    {
      name: t("campaigns.trigger.callback.name"),
      rule: t("campaigns.trigger.callback.rule").replace(
        "{n}",
        String(num(c.triggers, "CALLBACK_REQUESTED", "suppressHours", 24))
      ),
      scope: t("campaigns.trigger.scope.account")
    },
    {
      name: t("campaigns.trigger.intentMet.name"),
      rule: t("campaigns.trigger.intentMet.rule"),
      scope: t("campaigns.trigger.scope.global")
    }
  ];
  if (c.triggers.some((x) => x.type === "DNC_CHECK")) {
    rules.push({
      name: t("campaigns.trigger.dnc.name"),
      rule: t("campaigns.trigger.dnc.rule"),
      scope: t("campaigns.trigger.scope.global")
    });
  }
  return rules;
}

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const utils = trpc.useUtils();
  const timeZone = useWorkspaceTimezone();
  const [editing, setEditing] = useState(false);

  const query = trpc.campaigns.get.useQuery({ id: id! });
  const updateStatus = trpc.campaigns.updateStatus.useMutation({
    onSuccess: () => utils.campaigns.get.invalidate({ id: id! })
  });

  const c = query.data as
    | {
        id: string;
        name: string;
        status: CampaignStatus;
        pauseReason: CampaignPauseReason | null;
        startDate: string;
        endDate: string | null;
        daysOfWeek: number[];
        startTime: string;
        endTime: string;
        maxAttemptsPerAccount: number;
        maxAttemptsPerDay: number;
        agentTemplate: { id: string; name: string; type: string } | null;
        triggers: Trigger[];
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

  const run = c && timeZone ? nextRun(c, timeZone) : null;
  const meta = c
    ? [
        c.agentTemplate
          ? t(`agents.type.${c.agentTemplate.type}` as Parameters<typeof t>[0])
          : null,
        run?.kind === "now"
          ? formatNextRun(run, t, language).toLowerCase()
          : run
            ? t("campaigns.detail.nextRun").replace(
                "{when}",
                formatNextRun(run, t, language).toLowerCase()
              )
            : null
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const daysLabel = c
    ? [...c.daysOfWeek].sort().join(",") === "1,2,3,4,5"
      ? t("campaigns.detail.weekdays")
      : humanizeDays(c.daysOfWeek ?? [], t)
    : "";
  const endYmd = c ? toYmd(c.endDate) : "";

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb
        items={[{ label: t("campaigns.title"), href: "/campaigns" }, { label: c?.name ?? "…" }]}
      />

      <DetailHeader
        icon={<Megaphone />}
        title={c?.name ?? "…"}
        badge={
          c ? (
            <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-xs">
              {t(`campaigns.status.${c.status}` as Parameters<typeof t>[0])}
            </Badge>
          ) : undefined
        }
        meta={meta || undefined}
        actions={
          c ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                {t("campaigns.actions.edit")}
              </Button>
              {primary && (
                <Button
                  variant={primary === "ACTIVE" ? "default" : "secondary"}
                  onClick={() => updateStatus.mutate({ id: c.id, status: primary })}
                >
                  {primary === "ACTIVE" ? (
                    <Play className="h-4 w-4" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                  {t(STATUS_ACTION[primary] as Parameters<typeof t>[0])}
                </Button>
              )}
              {menuItems.length > 0 && <RowActionsMenu items={menuItems} />}
            </>
          ) : undefined
        }
      />

      {c?.pauseReason === "AUTO_ERROR_THRESHOLD" && <CampaignAutopausedBanner />}

      {c && (
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Panel title={t("campaigns.detail.program")}>
              <KeyValues
                rows={[
                  [t("campaigns.detail.agent"), agentLabel(c.agentTemplate, t)],
                  [
                    t("campaigns.detail.portfolios"),
                    c.portfolios.map((p) => p.portfolio.name).join(", ") || "—"
                  ],
                  [
                    t("campaigns.detail.startDate"),
                    <span className="font-mono">{formatDmy(toYmd(c.startDate))}</span>
                  ],
                  [
                    t("campaigns.detail.endDate"),
                    endYmd ? <span className="font-mono">{formatDmy(endYmd)}</span> : "—"
                  ]
                ]}
              />
            </Panel>
            <Panel
              title={t("campaigns.detail.window")}
              right={
                timeZone
                  ? t("campaigns.detail.tz").replace("{city}", timeZoneCity(timeZone))
                  : undefined
              }
            >
              <KeyValues
                rows={[
                  [t("campaigns.form.days"), daysLabel],
                  [
                    t("campaigns.detail.schedule"),
                    <span className="font-mono">{`${c.startTime} – ${c.endTime}`}</span>
                  ]
                ]}
              />
            </Panel>
            <Panel title={t("campaigns.detail.caps")}>
              <KeyValues
                rows={[
                  [
                    t("campaigns.detail.maxPerAccount"),
                    <span className="font-mono">{c.maxAttemptsPerAccount}</span>
                  ],
                  [
                    t("campaigns.detail.maxPerDay"),
                    <span className="font-mono">{c.maxAttemptsPerDay}</span>
                  ]
                ]}
              />
            </Panel>
          </div>

          <Panel
            title={t("campaigns.detail.triggers")}
            right={t("campaigns.detail.triggersScope")}
            className="w-[460px] shrink-0"
          >
            <ul className="-mb-1 flex flex-col">
              {triggerRules(c, t).map((r) => (
                <li
                  key={r.name}
                  className="flex items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-fg">{r.name}</span>
                    <span className="text-xs text-fg-muted">{r.rule}</span>
                  </div>
                  <Badge variant="secondary" className="shrink-0 rounded-md px-2 py-0.5 text-xs">
                    {r.scope}
                  </Badge>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {editing && c && (
        <EditCampaignDrawer
          campaign={c}
          onClose={() => setEditing(false)}
          onSuccess={() => {
            setEditing(false);
            utils.campaigns.get.invalidate({ id: c.id });
            utils.campaigns.list.invalidate();
          }}
        />
      )}
    </div>
  );
}
