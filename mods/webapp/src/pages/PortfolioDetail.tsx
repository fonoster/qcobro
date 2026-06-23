import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { DataTable } from "../components/ui/data-table.js";
import { Button } from "../components/ui/button.js";
import { PageHeader } from "../components/page-header.js";
import { CsvSyncModal } from "../components/portfolios/CsvSyncModal.js";
import { ReachOutModal } from "../components/portfolios/ReachOutModal.js";
import { RowActionsMenu, type RowAction } from "../components/ui/row-actions-menu.js";

const PAGE_SIZE = 50;

function money(v: number, currency: string) {
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency,
    minimumFractionDigits: 0
  }).format(v);
}

export function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [showSync, setShowSync] = useState(false);
  const [reachOut, setReachOut] = useState<Record<string, unknown> | null>(null);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/portfolios")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("portfolios.detail.back")}
        </Button>
      </div>

      <PageHeader title={portfolio.data?.name ?? "…"} description={portfolio.data?.clientId} />

      <DataTable
        data={items as Record<string, unknown>[]}
        keyField="id"
        searchable={true}
        searchPlaceholder="Buscar cuenta..."
        actionLabel={t("portfolios.csv.title")}
        onAction={() => setShowSync(true)}
        page={page}
        totalPages={totalPages}
        totalRecords={total}
        onPageChange={setPage}
        columns={[
          { key: "externalId", header: t("portfolios.detail.col.externalId") },
          { key: "fullName", header: t("portfolios.detail.col.name") },
          {
            key: "phone",
            header: t("portfolios.detail.col.phone"),
            render: (r) => String(r.phone ?? "—")
          },
          {
            key: "outstandingBalance",
            header: t("portfolios.detail.col.balance"),
            render: (r) => money(r.outstandingBalance as number, portfolio.data?.currency ?? "USD"),
            align: "right"
          },
          {
            key: "daysPastDue",
            header: t("portfolios.detail.col.dpd"),
            render: (r) => String(r.daysPastDue),
            align: "right"
          },
          // `preferredLanguage` is kept on the record as a reserved field for future
          // language-aware routing, but intentionally not shown in the console table.
          {
            key: "id",
            header: "",
            align: "center",
            render: (r) => {
              const items: RowAction[] = [
                {
                  label: t("portfolios.reachOut.action"),
                  onClick: () => setReachOut(r)
                }
              ];
              return <RowActionsMenu items={items} />;
            }
          }
        ]}
      />

      {reachOut && portfolio.data && (
        <ReachOutModal
          account={
            reachOut as Record<string, unknown> & {
              id: string;
              fullName: string;
              phone?: string | null;
            }
          }
          portfolio={{ currency: portfolio.data.currency }}
          onClose={() => setReachOut(null)}
          onSuccess={() => {
            setReachOut(null);
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
          }}
        />
      )}
    </div>
  );
}
