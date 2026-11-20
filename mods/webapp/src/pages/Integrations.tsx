import { useState } from "react";
import { Info, Phone, Plus } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { PageHeader } from "../components/page-header.js";
import { Panel } from "../components/panel.js";
import { Button } from "../components/ui/button.js";
import { InputGroup } from "../components/ui/input.js";
import { Dialog } from "../components/ui/dialog.js";
import { DataTable, TableCellStack } from "../components/ui/data-table.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";

type SenderRow = {
  id: string;
  phoneNumberId: string;
  displayNumber: string;
  label: string;
};

function AddSenderDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { t } = useI18n();
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayNumber, setDisplayNumber] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = trpc.whatsAppIntegration.addSender.useMutation({
    onSuccess: () => {
      setError(null);
      onSuccess();
    },
    onError: () => setError(t("integrations.senders.addError"))
  });

  const complete = !!phoneNumberId.trim() && !!displayNumber.trim() && !!label.trim();

  function handleAdd() {
    if (!complete) return;
    setError(null);
    add.mutate({
      phoneNumberId: phoneNumberId.trim(),
      displayNumber: displayNumber.trim(),
      label: label.trim()
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      width={520}
      title={t("integrations.senders.add")}
      subtitle={t("integrations.senders.addDescription")}
      confirmLabel={
        add.isPending ? t("integrations.senders.adding") : t("integrations.senders.add")
      }
      confirmDisabled={add.isPending || !complete}
      onSubmit={handleAdd}
      error={error}
    >
      <InputGroup
        label={t("integrations.senders.phoneNumberId")}
        id="s-pnid"
        className="[&_input]:font-mono"
        placeholder={t("integrations.senders.phoneNumberIdPlaceholder")}
        value={phoneNumberId}
        onChange={(e) => setPhoneNumberId(e.target.value)}
        autoFocus
      />
      <InputGroup
        label={t("integrations.senders.displayNumber")}
        id="s-dn"
        className="[&_input]:font-mono"
        placeholder={t("integrations.senders.displayNumberPlaceholder")}
        value={displayNumber}
        onChange={(e) => setDisplayNumber(e.target.value)}
      />
      <InputGroup
        label={t("integrations.senders.label")}
        id="s-label"
        placeholder={t("integrations.senders.labelPlaceholder")}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="flex gap-2.5 rounded-control bg-elevated px-3 py-2.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted" />
        <p className="text-xs text-fg-muted">{t("integrations.senders.addNote")}</p>
      </div>
    </Dialog>
  );
}

type WabaDraft = { wabaId?: string; accessToken?: string; verifyToken?: string; lang?: string };

function WabaPanel() {
  const { t } = useI18n();
  const integration = trpc.whatsAppIntegration.get.useQuery();
  const utils = trpc.useUtils();

  // Uncontrolled-until-edited: each field shows the stored value until the operator types.
  const [draft, setDraft] = useState<WabaDraft>({});
  const [status, setStatus] = useState<null | "ok" | "error">(null);

  const upsert = trpc.whatsAppIntegration.upsert.useMutation({
    onSuccess: () => {
      setStatus("ok");
      setDraft({});
      utils.whatsAppIntegration.get.invalidate();
    },
    onError: () => setStatus("error")
  });

  const data = integration.data;
  const connected = !!data?.connected;
  const wabaId = draft.wabaId ?? data?.wabaId ?? "";
  const verifyToken = draft.verifyToken ?? data?.verifyToken ?? "";
  const accessToken = draft.accessToken ?? "";
  const defaultLanguage = draft.lang ?? (data?.defaultLanguage || "es_DO");
  const dirty = Object.keys(draft).length > 0;

  function edit(patch: WabaDraft) {
    setStatus(null);
    setDraft((d) => ({ ...d, ...patch }));
  }

  function handleSave() {
    if (!wabaId.trim() || !verifyToken.trim() || !defaultLanguage.trim()) return;
    setStatus(null);
    upsert.mutate({
      wabaId: wabaId.trim(),
      accessToken: accessToken.trim() || "KEEP",
      verifyToken: verifyToken.trim(),
      defaultLanguage: defaultLanguage.trim()
    });
  }

  const noCloak =
    upsert.error?.message.includes("PRECONDITION_FAILED") ||
    integration.error?.message.includes("PRECONDITION_FAILED");

  return (
    <Panel
      className="w-full shrink-0 lg:w-[440px]"
      title={t("integrations.waba.section")}
      aside={
        <span className="text-[13px] text-fg">
          {connected ? t("integrations.waba.connected") : t("integrations.waba.notConnected")}
        </span>
      }
    >
      {noCloak ? (
        <p className="rounded-control bg-warning-soft px-3 py-2.5 text-[13px] text-warning">
          {t("integrations.waba.noCloak")}
        </p>
      ) : (
        <>
          <p className="text-xs text-fg-muted">{t("integrations.waba.intro")}</p>
          <InputGroup
            label={t("integrations.waba.wabaId")}
            id="w-wabaid"
            className="[&_input]:font-mono"
            placeholder={t("integrations.waba.wabaIdPlaceholder")}
            value={wabaId}
            onChange={(e) => edit({ wabaId: e.target.value })}
          />
          <InputGroup
            label={t(
              connected ? "integrations.waba.accessTokenConnected" : "integrations.waba.accessToken"
            )}
            id="w-token"
            type="password"
            className="[&_input]:font-mono"
            placeholder={connected ? undefined : t("integrations.waba.accessTokenPlaceholder")}
            value={accessToken}
            onChange={(e) => edit({ accessToken: e.target.value })}
          />
          <InputGroup
            label={t("integrations.waba.verifyToken")}
            id="w-verify"
            className="[&_input]:font-mono"
            placeholder={t("integrations.waba.verifyTokenPlaceholder")}
            value={verifyToken}
            onChange={(e) => edit({ verifyToken: e.target.value })}
          />
          <InputGroup
            label={t("integrations.waba.defaultLanguage")}
            id="w-lang"
            className="[&_input]:font-mono"
            placeholder="es_DO"
            value={defaultLanguage}
            onChange={(e) => edit({ lang: e.target.value })}
          />
          <div className="flex items-center justify-end gap-2.5">
            {status === "ok" && (
              <span className="mr-auto text-[13px] text-fg-muted">
                {t("integrations.waba.saved")}
              </span>
            )}
            {status === "error" && (
              <span className="mr-auto text-[13px] text-danger">
                {t("integrations.waba.error")}
              </span>
            )}
            <Button
              variant="ghost"
              disabled={!dirty || upsert.isPending}
              onClick={() => {
                setDraft({});
                setStatus(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? t("integrations.waba.saving") : t("integrations.waba.save")}
            </Button>
          </div>
        </>
      )}
    </Panel>
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
  const [showAddSender, setShowAddSender] = useState(false);
  const connected = !!integration.data?.connected;

  function handleRemove(phoneNumberId: string) {
    setRemoveError(null);
    remove.mutate(
      { phoneNumberId },
      { onError: () => setRemoveError(t("integrations.senders.removeError")) }
    );
  }

  const rows = (senders.data ?? []) as SenderRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("integrations.title")} description={t("integrations.subtitle")} />

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <WabaPanel />

        <section className="flex w-full min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-medium text-fg">{t("integrations.senders.section")}</h2>
              <p className="text-xs text-fg-muted">{t("integrations.senders.subtitle")}</p>
            </div>
            <Button variant="outline" disabled={!connected} onClick={() => setShowAddSender(true)}>
              <Plus className="h-4 w-4" />
              {t("integrations.senders.add")}
            </Button>
          </div>

          {!connected ? (
            <EmptyState
              icon={<Phone />}
              title={t("integrations.senders.emptyTitle")}
              body={t("integrations.senders.noIntegration")}
            />
          ) : (
            <DataTable
              data={rows}
              keyField="id"
              searchable={false}
              rowHeight={60}
              empty={
                senders.isLoading ? undefined : (
                  <EmptyState
                    icon={<Phone />}
                    title={t("integrations.senders.emptyTitle")}
                    body={t("integrations.senders.empty")}
                  />
                )
              }
              columns={[
                {
                  key: "displayNumber",
                  header: t("integrations.senders.col.number"),
                  render: (s) => (
                    <TableCellStack
                      title={<span className="font-mono font-normal">{s.displayNumber}</span>}
                      sub={s.label}
                    />
                  )
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  width: 40,
                  render: (s) => (
                    <RowActionsMenu
                      items={[
                        {
                          label: t("integrations.senders.remove"),
                          variant: "destructive",
                          onClick: () => handleRemove(s.phoneNumberId)
                        }
                      ]}
                    />
                  )
                }
              ]}
            />
          )}
          {removeError && <p className="text-xs text-danger">{removeError}</p>}
        </section>
      </div>

      {showAddSender && (
        <AddSenderDialog
          onClose={() => setShowAddSender(false)}
          onSuccess={() => {
            setShowAddSender(false);
            utils.whatsAppIntegration.listSenders.invalidate();
          }}
        />
      )}
    </div>
  );
}
