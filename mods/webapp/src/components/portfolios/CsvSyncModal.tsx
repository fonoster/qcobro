import { useRef, useState } from "react";
import { trpc } from "../../lib/trpc.js";
import { useI18n } from "../../lib/i18n.js";
import { parseCsv } from "../../lib/csv.js";
import type { AccountRowInput } from "@qcobro/common";
import { Button } from "../ui/button.js";
import { Dialog } from "../ui/dialog.js";

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
  const [mode, setMode] = useState<SyncMode>("APPEND_ONLY");
  const [rows, setRows] = useState<AccountRowInput[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    archived: number;
    total: number;
  } | null>(null);
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
    };
    reader.readAsText(file);
  }

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
    >
      <div className="mt-4 flex flex-col gap-4">
        {!result ? (
          <>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                {t("portfolios.csv.selectFile")}
              </Button>
              <span className="text-sm text-slate-500">
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

            {parseErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="mb-1 text-xs font-medium text-red-700">
                  {t("portfolios.csv.errors.title")}
                </p>
                {parseErrors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">
                    {e}
                  </p>
                ))}
              </div>
            )}

            {syncError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="mb-1 text-xs font-medium text-red-700">
                  {t("portfolios.csv.error.title")}
                </p>
                <p className="text-xs text-red-600">{syncError}</p>
              </div>
            )}

            {rows.length > 0 && parseErrors.length === 0 && (
              <p className="text-sm text-emerald-700">
                {t("portfolios.csv.ready").replace("{n}", String(rows.length))}
              </p>
            )}

            <div>
              <p className="mb-2 text-xs font-medium text-slate-700">
                {t("portfolios.csv.mode.label")}
              </p>
              <div className="flex flex-col gap-2">
                {SYNC_MODES.map((m) => (
                  <label
                    key={m.value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50"
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
                      <p className="text-sm font-medium text-slate-900">
                        {t(`portfolios.csv.mode.${m.value}.label` as Parameters<typeof t>[0])}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t(`portfolios.csv.mode.${m.value}.description` as Parameters<typeof t>[0])}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="mb-3 text-sm font-semibold text-emerald-800">
              {t("portfolios.csv.done")}
            </p>
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
          </div>
        )}
      </div>
    </Dialog>
  );
}
