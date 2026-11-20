import { useState } from "react";
import { useParams } from "react-router-dom";
import { Eye, FolderOpen, PhoneCall } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { useMoney, useWorkspaceCurrency } from "../lib/useWorkspaceCurrency.js";
import { DataTable, TableCellStack } from "../components/ui/data-table.js";
import { Button } from "../components/ui/button.js";
import { DetailHeader } from "../components/detail-header.js";
import { Breadcrumb } from "../components/ui/breadcrumb.js";
import { Drawer } from "../components/ui/drawer.js";
import { Accordion } from "../components/ui/accordion.js";
import { CsvSyncModal } from "../components/portfolios/CsvSyncModal.js";
import { ReachOutModal } from "../components/portfolios/ReachOutModal.js";
import { BulkReachOutModal } from "../components/portfolios/BulkReachOutModal.js";
import { RowActionsMenu, type RowAction } from "../components/ui/row-actions-menu.js";

const PAGE_SIZE = 50;

export function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  // wsCurrency (the raw currency code) is still needed for the ReachOutModal's outreach
  // preview below; money() is the shared workspace-locale formatter for this page's tables.
  const wsCurrency = useWorkspaceCurrency();
  const money = useMoney();
  const [page, setPage] = useState(1);
  const [showSync, setShowSync] = useState(false);
  const [reachOut, setReachOut] = useState<Record<string, unknown> | null>(null);
  const [viewDetail, setViewDetail] = useState<Record<string, unknown> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  const portfolio = trpc.portfolios.get.useQuery({ id: id! });
  const accounts = trpc.portfolios.listAccounts.useQuery({
    portfolioId: id!,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE
  });
  const utils = trpc.useUtils();

  const items = accounts.data?.items ?? [];
  const total = accounts.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const count = (key: "activeAccounts" | "accounts", n: number) =>
    t(`portfolios.detail.${key}.${n === 1 ? "one" : "other"}`).replace(
      "{count}",
      n.toLocaleString()
    );
  const p = portfolio.data;
  // One facts line from the portfolio record; a portfolio never synced reads 0 and a zero
  // balance. Nothing renders until the record loads.
  const facts = p
    ? [
        p.clientId,
        count("activeAccounts", p.accountCount ?? 0),
        t("portfolios.detail.balance").replace("{amount}", money(p.totalOutstandingBalance ?? 0))
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[{ label: t("portfolios.title"), href: "/portfolios" }, { label: p?.name ?? "…" }]}
      />
      <DetailHeader
        icon={<FolderOpen />}
        title={p?.name ?? "…"}
        meta={facts ?? undefined}
        actions={
          <Button onClick={() => setShowSync(true)} disabled={!p}>
            {t("portfolios.csv.title")}
          </Button>
        }
      />

      <DataTable
        data={items as Record<string, unknown>[]}
        keyField="id"
        searchable={true}
        searchPlaceholder={t("portfolios.detail.searchPlaceholder")}
        searchClassName="w-80"
        toolbarEnd={<span className="text-[13px] text-fg-muted">{count("accounts", total)}</span>}
        rowHeight={60}
        pageSize={PAGE_SIZE}
        selectable
        getRowId={(r) => r.id as string}
        selectedIds={selected}
        onSelectionChange={setSelected}
        bulkActions={
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            {t("portfolios.bulk.action")}
          </Button>
        }
        page={page}
        totalPages={totalPages}
        totalRecords={total}
        onPageChange={setPage}
        columns={[
          // `preferredLanguage` is kept on the record as a reserved field for future
          // language-aware routing, but intentionally not shown in the console table.
          {
            key: "fullName",
            header: t("portfolios.detail.col.name"),
            render: (r) => (
              <TableCellStack
                title={String(r.fullName ?? "—")}
                sub={[r.externalId, r.phone].filter(Boolean).join(" · ")}
              />
            )
          },
          {
            key: "outstandingBalance",
            header: t("portfolios.detail.col.balance"),
            render: (r) => money(r.outstandingBalance as number),
            mono: true,
            align: "right"
          },
          {
            key: "daysPastDue",
            header: t("portfolios.detail.col.dpd"),
            render: (r) => String(r.daysPastDue),
            mono: true,
            align: "right"
          },
          {
            key: "id",
            header: "",
            align: "right",
            className: "w-px whitespace-nowrap",
            render: (r) => {
              const items: RowAction[] = [
                {
                  label: t("portfolios.reachOut.action"),
                  icon: PhoneCall,
                  onClick: () => setReachOut(r)
                },
                {
                  label: t("portfolios.detail.viewDetail"),
                  icon: Eye,
                  onClick: () => setViewDetail(r)
                }
              ];
              return <RowActionsMenu items={items} />;
            }
          }
        ]}
      />

      {viewDetail && (
        <Drawer
          open
          onClose={() => setViewDetail(null)}
          title={String(viewDetail.fullName ?? "—")}
          subtitle={<span className="font-mono">{String(viewDetail.externalId ?? "")}</span>}
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            {[
              [t("portfolios.detail.col.balance"), money(viewDetail.outstandingBalance as number)],
              [t("portfolios.detail.col.dpd"), String(viewDetail.daysPastDue ?? "—")],
              [t("gestiones.detail.phone"), String(viewDetail.phone ?? "—")],
              [t("gestiones.detail.email"), String(viewDetail.email ?? "—")]
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-fg-muted">{label}</dt>
                <dd className="font-mono text-sm text-fg">{value}</dd>
              </div>
            ))}
          </dl>

          <Accordion
            items={[
              {
                id: "raw",
                title: t("portfolios.detail.viewMetadata"),
                content: (
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-fg-muted">
                    {JSON.stringify(
                      Object.fromEntries(
                        Object.entries(viewDetail).filter(
                          ([key]) =>
                            !["outstandingBalance", "daysPastDue", "phone", "email"].includes(key)
                        )
                      ),
                      null,
                      2
                    )}
                  </pre>
                )
              }
            ]}
          />
        </Drawer>
      )}

      {reachOut && portfolio.data && (
        <ReachOutModal
          account={
            reachOut as Record<string, unknown> & {
              id: string;
              fullName: string;
              phone?: string | null;
              email?: string | null;
            }
          }
          portfolio={{ currency: wsCurrency }}
          onClose={() => setReachOut(null)}
          onSuccess={() => {
            setReachOut(null);
            utils.portfolios.listAccounts.invalidate({ portfolioId: id! });
          }}
        />
      )}

      {bulkOpen && (
        <BulkReachOutModal
          accountIds={selected}
          onClose={() => setBulkOpen(false)}
          onSuccess={() => {
            setBulkOpen(false);
            setSelected([]);
            utils.portfolios.listAccounts.invalidate({ portfolioId: id! });
          }}
        />
      )}

      {showSync && portfolio.data && (
        <CsvSyncModal
          portfolio={{ id: portfolio.data.id, name: portfolio.data.name }}
          onClose={() => setShowSync(false)}
          onSuccess={() => {
            setShowSync(false);
            utils.portfolios.get.invalidate({ id: id! });
            utils.portfolios.listAccounts.invalidate({ portfolioId: id! });
            utils.recovery.invalidate();
          }}
        />
      )}
    </div>
  );
}
