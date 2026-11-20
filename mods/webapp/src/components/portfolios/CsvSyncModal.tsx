import { useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { trpc } from "../../lib/trpc.js";
import { useI18n } from "../../lib/i18n.js";
import { parseCsv } from "../../lib/csv.js";
import { useMoney } from "../../lib/useWorkspaceCurrency.js";
import type { AccountRowInput, SyncResult } from "@qcobro/common";
import { Button } from "../ui/button.js";
import { Dialog } from "../ui/dialog.js";
import { ChoiceCardGroup } from "../ui/choice-cards.js";

/** A muted warning, icon and words, for an import that won't detect what the operator expects. */
function ImportWarning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-fg-subtle">
      <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

type SyncMode = "APPEND_ONLY" | "UPDATE_EXISTING" | "REPLACE";

const SYNC_MODES: { value: SyncMode }[] = [
  { value: "APPEND_ONLY" },
  { value: "UPDATE_EXISTING" },
  { value: "REPLACE" }
];

export function CsvSyncModal({
  portfolio,
  onClose,
  onSuccess
}: {
  portfolio: { id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const money = useMoney();
  // UPDATE_EXISTING by default: APPEND_ONLY never updates an account, so it detects no payments.
  const [mode, setMode] = useState<SyncMode>("UPDATE_EXISTING");
  const [rows, setRows] = useState<AccountRowInput[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sync = trpc.portfolios.syncAccounts.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setSyncError(null);
    },
    onError: (err) => setSyncError(err.message)
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setSyncError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target?.result as string);
      setRows(parsed.rows);
      setParseErrors(parsed.errors);
      setColumns(parsed.columns);
    };
    reader.readAsText(file);
  }

  // Recoveries this import detected; the console shows no exits (classifying them is API-only).
  const detected = result
    ? result.recoveries.partial + result.recoveries.caughtUp + result.recoveries.paidOff
    : 0;

  const canSync = rows.length > 0 && parseErrors.length === 0 && !sync.isPending && !result;

  return (
    <Dialog
      open
      onClose={onClose}
      width={560}
      title={result ? t("portfolios.csv.done") : t("portfolios.csv.title")}
      subtitle={result ? undefined : `${portfolio.name} · ${t("portfolios.csv.description")}`}
      footer={result ? <Button onClick={onSuccess}>{t("portfolios.csv.close")}</Button> : undefined}
      confirmLabel={
        sync.isPending
          ? t("portfolios.csv.importing")
          : rows.length > 0
            ? t("portfolios.csv.import").replace("{n}", String(rows.length))
            : t("portfolios.csv.title")
      }
      confirmDisabled={!canSync}
      onConfirm={() => canSync && sync.mutate({ portfolioId: portfolio.id, mode, rows })}
      error={syncError}
    >
      <div className="flex flex-col gap-4">
        {!result ? (
          <>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                {t("portfolios.csv.selectFile")}
              </Button>
              <span className="text-sm text-fg-subtle">
                {fileName || t("portfolios.csv.noFile")}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFile}
              />
            </div>

            <p className="text-xs text-fg-subtle">{t("portfolios.csv.fileHint")}</p>

            {parseErrors.length > 0 && (
              <div className="rounded-md border border-danger/30 bg-danger-soft p-3">
                <p className="mb-1 text-xs font-medium text-danger">
                  {t("portfolios.csv.errors.title")}
                </p>
                {parseErrors.map((e, i) => (
                  <p key={i} className="text-xs text-danger">
                    {e}
                  </p>
                ))}
              </div>
            )}

            {rows.length > 0 && parseErrors.length === 0 && (
              <p className="text-sm text-fg">
                {t("portfolios.csv.ready").replace("{n}", String(rows.length))}
              </p>
            )}

            {rows.length > 0 && !columns.includes("missed_installments") && (
              <ImportWarning>{t("portfolios.csv.warning.missedInstallments")}</ImportWarning>
            )}

            <div>
              <ChoiceCardGroup
                label={t("portfolios.csv.mode.label")}
                name="syncMode"
                vertical
                value={mode}
                onChange={setMode}
                options={SYNC_MODES.map((m) => ({
                  value: m.value,
                  title: t(`portfolios.csv.mode.${m.value}.label` as Parameters<typeof t>[0]),
                  description: t(
                    `portfolios.csv.mode.${m.value}.description` as Parameters<typeof t>[0]
                  )
                }))}
              />
              {mode === "APPEND_ONLY" && (
                <div className="mt-2">
                  <ImportWarning>{t("portfolios.csv.warning.appendOnly")}</ImportWarning>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-control border border-border bg-elevated p-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { label: t("portfolios.csv.created"), value: result.created },
                { label: t("portfolios.csv.updated"), value: result.updated },
                { label: t("portfolios.csv.archived"), value: result.archived },
                { label: t("portfolios.csv.total"), value: result.total }
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-mono text-2xl font-medium text-fg">{value}</p>
                  <p className="text-xs text-fg-muted">{label}</p>
                </div>
              ))}
            </div>
            {detected > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[13px] text-fg">
                <span className="font-medium">{t("portfolios.csv.paymentsDetected")}</span>
                <span className="font-semibold">
                  {money(result.recoveries.amount)} ·{" "}
                  {detected === 1
                    ? t("portfolios.recovery.accounts.one")
                    : t("portfolios.recovery.accounts.other").replace(
                        "{count}",
                        detected.toLocaleString()
                      )}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
