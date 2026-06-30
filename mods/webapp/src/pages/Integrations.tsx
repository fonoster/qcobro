import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { PageHeader } from "../components/page-header.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { InputGroup } from "../components/ui/input.js";

type SenderRow = {
  id: string;
  phoneNumberId: string;
  displayNumber: string;
  label: string;
};

function AddSenderForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n();
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayNumber, setDisplayNumber] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = trpc.whatsAppIntegration.addSender.useMutation({
    onSuccess: () => {
      setPhoneNumberId("");
      setDisplayNumber("");
      setLabel("");
      setError(null);
      onSuccess();
    },
    onError: (err) => setError(err.message)
  });

  function handleAdd() {
    if (!phoneNumberId.trim() || !displayNumber.trim() || !label.trim()) return;
    setError(null);
    add.mutate({
      phoneNumberId: phoneNumberId.trim(),
      displayNumber: displayNumber.trim(),
      label: label.trim()
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <InputGroup
          label={t("integrations.senders.phoneNumberId")}
          id="s-pnid"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
        />
        <InputGroup
          label={t("integrations.senders.displayNumber")}
          id="s-dn"
          value={displayNumber}
          onChange={(e) => setDisplayNumber(e.target.value)}
        />
        <InputGroup
          label={t("integrations.senders.label")}
          id="s-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <Button
          onClick={handleAdd}
          disabled={
            add.isPending || !phoneNumberId.trim() || !displayNumber.trim() || !label.trim()
          }
        >
          {add.isPending ? t("integrations.senders.adding") : t("integrations.senders.add")}
        </Button>
      </div>
    </div>
  );
}

function WabaForm() {
  const { t } = useI18n();
  const integration = trpc.whatsAppIntegration.get.useQuery();
  const utils = trpc.useUtils();

  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState("es_DO");
  const [status, setStatus] = useState<null | "ok" | "error">(null);

  const upsert = trpc.whatsAppIntegration.upsert.useMutation({
    onSuccess: () => {
      setStatus("ok");
      setAccessToken("");
      utils.whatsAppIntegration.get.invalidate();
    },
    onError: () => setStatus("error")
  });

  const connected = !!integration.data;

  function handleSave() {
    if (!wabaId.trim() && !integration.data?.wabaId) return;
    if (!verifyToken.trim() && !integration.data?.verifyToken) return;
    if (!defaultLanguage.trim()) return;
    setStatus(null);
    upsert.mutate({
      wabaId: wabaId.trim() || (integration.data?.wabaId ?? ""),
      accessToken: accessToken.trim() || "KEEP",
      verifyToken: verifyToken.trim() || (integration.data?.verifyToken ?? ""),
      defaultLanguage: defaultLanguage.trim()
    });
  }

  if (
    upsert.error?.message.includes("PRECONDITION_FAILED") ||
    integration.error?.message.includes("PRECONDITION_FAILED")
  ) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
        {t("integrations.waba.noCloak")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`} />
        <span className="text-sm text-slate-600">
          {connected ? t("integrations.waba.connected") : t("integrations.waba.notConnected")}
          {connected && integration.data?.wabaId ? ` · ${integration.data.wabaId}` : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InputGroup
          label={t("integrations.waba.wabaId")}
          id="w-wabaid"
          placeholder={integration.data?.wabaId ?? ""}
          value={wabaId}
          onChange={(e) => setWabaId(e.target.value)}
        />
        <InputGroup
          label={t("integrations.waba.verifyToken")}
          id="w-verify"
          placeholder={integration.data?.verifyToken ?? ""}
          value={verifyToken}
          onChange={(e) => setVerifyToken(e.target.value)}
        />
        <InputGroup
          label={t("integrations.waba.accessToken")}
          id="w-token"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          hint={connected ? t("integrations.waba.accessTokenHint") : undefined}
        />
        <InputGroup
          label={t("integrations.waba.defaultLanguage")}
          id="w-lang"
          placeholder="es_DO"
          value={defaultLanguage}
          onChange={(e) => setDefaultLanguage(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? t("integrations.waba.saving") : t("integrations.waba.save")}
        </Button>
        {status === "ok" && (
          <span className="text-sm text-emerald-600">{t("integrations.waba.saved")}</span>
        )}
        {status === "error" && (
          <span className="text-sm text-red-600">{t("integrations.waba.error")}</span>
        )}
      </div>
    </div>
  );
}

export function Integrations() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const integration = trpc.whatsAppIntegration.get.useQuery();
  const senders = trpc.whatsAppIntegration.listSenders.useQuery();

  const remove = trpc.whatsAppIntegration.removeSender.useMutation({
    onSuccess: () => utils.whatsAppIntegration.listSenders.invalidate()
  });

  const [removeError, setRemoveError] = useState<string | null>(null);

  function handleRemove(phoneNumberId: string) {
    setRemoveError(null);
    remove.mutate({ phoneNumberId }, { onError: (err) => setRemoveError(err.message) });
  }

  const rows = (senders.data ?? []) as SenderRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("integrations.title")} description={t("integrations.subtitle")} />

      <Card className="max-w-[720px] rounded-xl border-slate-200 shadow-none">
        <div className="flex flex-col gap-5 p-6">
          <h2 className="text-sm font-semibold text-slate-900">{t("integrations.waba.section")}</h2>
          <WabaForm />
        </div>
      </Card>

      <Card className="max-w-[720px] rounded-xl border-slate-200 shadow-none">
        <div className="flex flex-col gap-5 p-6">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("integrations.senders.section")}
          </h2>

          {!integration.data ? (
            <p className="text-sm text-slate-400">{t("integrations.senders.noIntegration")}</p>
          ) : (
            <>
              {rows.length === 0 ? (
                <p className="text-sm text-slate-400">{t("integrations.senders.empty")}</p>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {rows.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-slate-800">{s.label}</span>
                        <span className="text-xs text-slate-400">
                          {s.displayNumber} · {s.phoneNumberId}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => handleRemove(s.phoneNumberId)}
                      >
                        {t("integrations.senders.remove")}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {removeError && <p className="text-xs text-red-600">{removeError}</p>}

              <AddSenderForm onSuccess={() => utils.whatsAppIntegration.listSenders.invalidate()} />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
