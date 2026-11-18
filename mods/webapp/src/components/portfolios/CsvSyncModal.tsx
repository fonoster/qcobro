import { useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { trpc } from "../../lib/trpc.js";
import { useI18n } from "../../lib/i18n.js";
import { parseCsv } from "../../lib/csv.js";
import { useMoney } from "../../lib/useWorkspaceCurrency.js";
import type { AccountRowInput, SyncResult } from "@qcobro/common";
import { Button } from "../ui/button.js";
import { Dialog } from "../ui/dialog.js";

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
    ? result.recoveries.partial + result.recoveries.cured + result.recoveries.paidOff
    : 0;

  const canSync = rows.length > 0 && parseErrors.length === 0 && !sync.isPending && !result;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t("portfolios.csv.title")} — ${portfolio.name}`}
      description={t("portfolios.csv.description")}
      confirmLabel={
        result
          ? t("portfolios.csv.close")
          : sync.isPending
            ? t("portfolios.csv.importing")
            : t("portfolios.csv.import").replace("{n}", String(rows.length))
      }
      onConfirm={
        result
          ? onSuccess
          : canSync
            ? () => sync.mutate({ portfolioId: portfolio.id, mode, rows })
            : undefined
      }
      className="max-w-lg"
      error={syncError}
    >
      <div className="mt-4 flex flex-col gap-4">
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
              <p className="text-sm text-primary">
                {t("portfolios.csv.ready").replace("{n}", String(rows.length))}
              </p>
            )}

            {rows.length > 0 && !columns.includes("missed_installments") && (
              <ImportWarning>{t("portfolios.csv.warning.missedInstallments")}</ImportWarning>
            )}

            <div>
              <p className="mb-2 text-xs font-medium text-fg-muted">
                {t("portfolios.csv.mode.label")}
              </p>
              <div className="flex flex-col gap-2">
                {SYNC_MODES.map((m) => (
                  <label
                    key={m.value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-elevated has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                  >
                    <input
                      type="radio"
                      name="syncMode"
                      value={m.value}
                      checked={mode === m.value}
                      onChange={() => setMode(m.value)}
                      className="mt-0.5 accent-emerald-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-fg">
                        {t(`portfolios.csv.mode.${m.value}.label` as Parameters<typeof t>[0])}
                      </p>
                      <p className="text-xs text-fg-subtle">
                        {t(`portfolios.csv.mode.${m.value}.description` as Parameters<typeof t>[0])}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              {mode === "APPEND_ONLY" && (
                <div className="mt-2">
                  <ImportWarning>{t("portfolios.csv.warning.appendOnly")}</ImportWarning>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
            <p className="mb-3 text-sm font-semibold text-primary">{t("portfolios.csv.done")}</p>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { label: t("portfolios.csv.created"), value: result.created, color: "emerald" },
                { label: t("portfolios.csv.updated"), value: result.updated, color: "blue" },
                { label: t("portfolios.csv.archived"), value: result.archived, color: "amber" },
                { label: t("portfolios.csv.total"), value: result.total, color: "slate" }
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className={`text-2xl font-bold text-${color}-700`}>{value}</p>
                  <p className={`text-xs text-${color}-600`}>{label}</p>
                </div>
              ))}
            </div>
            {detected > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-primary/30 pt-3 text-[13px] text-fg">
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
