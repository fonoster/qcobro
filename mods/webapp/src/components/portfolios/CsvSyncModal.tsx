import { useRef, useState } from "react";
import { FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { trpc } from "../../lib/trpc.js";
import { useI18n } from "../../lib/i18n.js";
import { parseCsv } from "../../lib/csv.js";
import { useMoney } from "../../lib/useWorkspaceCurrency.js";
import { cn } from "../../lib/utils.js";
import type { AccountRowInput, SyncResult } from "@qcobro/common";
import { Alert } from "../ui/alert.js";
import { Button } from "../ui/button.js";
import { Dialog } from "../ui/dialog.js";
import { ChoiceCardGroup } from "../ui/choice-cards.js";

/** A muted warning, icon and words, for an import that won't detect what the operator expects. */
function ImportWarning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-fg-muted">
      <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

type SyncMode = "APPEND_ONLY" | "UPDATE_EXISTING" | "REPLACE";

const SYNC_MODES: SyncMode[] = ["APPEND_ONLY", "UPDATE_EXISTING", "REPLACE"];

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
  const [dragging, setDragging] = useState(false);
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

  function readFile(file: File) {
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

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  // Recoveries this import detected; the console shows no exits (classifying them is API-only).
  const detected = result
    ? result.recoveries.partial + result.recoveries.caughtUp + result.recoveries.paidOff
    : 0;

  const canSync = rows.length > 0 && parseErrors.length === 0 && !sync.isPending && !result;
  const modeLabel = (m: SyncMode) => t(`portfolios.csv.mode.${m}.label` as Parameters<typeof t>[0]);

  if (result) {
    const stats = [
      { label: t("portfolios.csv.created"), value: result.created },
      { label: t("portfolios.csv.updated"), value: result.updated },
      { label: t("portfolios.csv.archived"), value: result.archived },
      { label: t("portfolios.csv.total"), value: result.total }
    ];
    // "Pagos detectados" only when the import detected some: no row reads better than RD$0.
    const details: [string, React.ReactNode][] = [
      ...(detected === 0
        ? []
        : [
            [
              t("portfolios.csv.paymentsDetected"),
              <span className="font-mono">
                {money(result.recoveries.amount)} ·{" "}
                {detected === 1
                  ? t("portfolios.recovery.accounts.one")
                  : t("portfolios.recovery.accounts.other").replace(
                      "{count}",
                      detected.toLocaleString()
                    )}
              </span>
            ] as [string, React.ReactNode]
          ]),
      [t("portfolios.csv.modeRow"), modeLabel(mode)],
      [t("portfolios.csv.fileRow"), <span className="font-mono text-xs">{fileName}</span>]
    ];
    return (
      <Dialog
        open
        onClose={onSuccess}
        width={560}
        title={t("portfolios.csv.done")}
        subtitle={t("portfolios.csv.doneSubtitle").replace("{name}", portfolio.name)}
        footer={<Button onClick={onSuccess}>{t("portfolios.csv.close")}</Button>}
      >
        <div className="grid grid-cols-4 gap-3 rounded-control bg-elevated px-[18px] py-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="font-mono text-[22px] font-medium leading-tight text-fg">
                {value.toLocaleString()}
              </span>
              <span className="text-xs text-fg-muted">{label}</span>
            </div>
          ))}
        </div>
        <dl className="flex flex-col gap-3">
          {details.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 text-[13px]">
              <dt className="text-fg-muted">{label}</dt>
              <dd className="text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
    );
  }

  const hasFile = Boolean(fileName);
  const fileOk = rows.length > 0 && parseErrors.length === 0;

  return (
    <Dialog
      open
      onClose={onClose}
      width={560}
      title={t("portfolios.csv.title")}
      subtitle={t("portfolios.csv.subtitle").replace("{name}", portfolio.name)}
      confirmLabel={
        sync.isPending
          ? t("portfolios.csv.importing")
          : rows.length > 0
            ? t("portfolios.csv.import").replace("{n}", String(rows.length))
            : t("portfolios.csv.title")
      }
      confirmDisabled={!canSync}
      onConfirm={() => canSync && sync.mutate({ portfolioId: portfolio.id, mode, rows })}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) readFile(file);
        }}
        className={cn(
          "flex items-center gap-3 rounded-control border bg-bg px-3.5 py-3",
          dragging ? "border-fg" : "border-border"
        )}
      >
        {hasFile ? (
          <FileSpreadsheet className="h-[18px] w-[18px] shrink-0 text-fg" aria-hidden="true" />
        ) : (
          <Upload className="h-[18px] w-[18px] shrink-0 text-fg-muted" aria-hidden="true" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {hasFile ? (
            <>
              <span className="truncate font-mono text-[13px] text-fg">{fileName}</span>
              {fileOk && (
                <span className="text-xs text-fg-muted">
                  {t("portfolios.csv.ready").replace("{n}", rows.length.toLocaleString())}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-sm text-fg">{t("portfolios.csv.drop")}</span>
              <span className="text-xs text-fg-muted">{t("portfolios.csv.fileHint")}</span>
            </>
          )}
        </div>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          {hasFile ? t("portfolios.csv.change") : t("portfolios.csv.selectFile")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {parseErrors.length > 0 && (
        <Alert variant="error" title={t("portfolios.csv.errors.title")}>
          <div className="mt-0.5 flex flex-col gap-0.5 opacity-80">
            {parseErrors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        </Alert>
      )}

      {syncError && (
        <Alert variant="error" title={t("portfolios.csv.errors.title")} description={syncError} />
      )}

      {fileOk && !columns.includes("missed_installments") && (
        <Alert
          variant="warning"
          title={t("portfolios.csv.warning.missedInstallments.title")}
          description={t("portfolios.csv.warning.missedInstallments")}
        />
      )}

      <div className="flex flex-col gap-2">
        <ChoiceCardGroup
          label={t("portfolios.csv.mode.label")}
          name="syncMode"
          vertical
          value={mode}
          onChange={setMode}
          options={SYNC_MODES.map((m) => ({
            value: m,
            title: modeLabel(m),
            description: t(`portfolios.csv.mode.${m}.description` as Parameters<typeof t>[0])
          }))}
        />
        {mode === "APPEND_ONLY" && (
          <ImportWarning>{t("portfolios.csv.warning.appendOnly")}</ImportWarning>
        )}
      </div>
    </Dialog>
  );
}
