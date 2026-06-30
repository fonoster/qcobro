import { useState } from "react";
import type { CreateApiKeyInput } from "@qcobro/common";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n, type MessageId } from "../lib/i18n.js";
import { isWorkspaceAdmin } from "../lib/workspaceRole.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable } from "../components/ui/data-table.js";
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";
import { ConfirmDeleteDialog } from "../components/ui/confirm-delete-dialog.js";
import { Dialog } from "../components/ui/dialog.js";
import { CreateApiKeyDialog } from "../components/CreateApiKeyDialog.js";
import { ShowSecretDialog, type ApiKeyCredentials } from "../components/ShowSecretDialog.js";

type Row = {
  ref: string;
  accessKeyId: string;
  role: string;
  expiresAt?: number | string | null;
};

export function ApiKeys() {
  const { t } = useI18n();
  const { workspace, accessToken } = useAuth();
  const utils = trpc.useUtils();

  const canManage = isWorkspaceAdmin(accessToken, workspace);

  const list = trpc.apiKeys.list.useQuery(undefined, { enabled: canManage });

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();
  const [secret, setSecret] = useState<ApiKeyCredentials | null>(null);
  const [regenTarget, setRegenTarget] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const create = trpc.apiKeys.create.useMutation();
  const regenerate = trpc.apiKeys.regenerate.useMutation();
  const remove = trpc.apiKeys.delete.useMutation();

  // Returns a localized date, or null when the value is absent or implausible.
  // Identity returns these timestamps in epoch SECONDS (widen to ms); it can also
  // return a garbage value for an API key's createdAt, which we treat as "no date".
  function fmtDate(v: number | string | null | undefined): string | null {
    if (v === null || v === undefined || v === "") return null;
    let value: number | string = v;
    if (typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
    if (typeof value === "number" && value < 1e12) value = value * 1000;
    const d = new Date(value);
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
    return d.toLocaleDateString();
  }

  async function onCreate(input: CreateApiKeyInput) {
    setCreateError(undefined);
    try {
      const res = await create.mutateAsync(input);
      setCreateOpen(false);
      setSecret(res);
      await utils.apiKeys.list.invalidate();
    } catch {
      setCreateError(t("apiKeys.create.error"));
    }
  }

  async function onRegenerate() {
    if (!regenTarget) return;
    setRegenError(undefined);
    try {
      const res = await regenerate.mutateAsync({ ref: regenTarget });
      setRegenTarget(null);
      setSecret(res);
      await utils.apiKeys.list.invalidate();
    } catch {
      setRegenError(t("apiKeys.regenerate.error"));
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    await remove.mutateAsync({ ref: deleteTarget });
    setDeleteTarget(null);
    await utils.apiKeys.list.invalidate();
  }

  const rows: Row[] = ((list.data?.items ?? []) as Row[]).map((k) => ({
    ref: k.ref,
    accessKeyId: k.accessKeyId,
    role: k.role,
    expiresAt: k.expiresAt
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("apiKeys.title")} description={t("apiKeys.description")} />

      {!canManage ? (
        <p className="text-sm text-slate-500">{t("apiKeys.empty")}</p>
      ) : (
        <DataTable
          data={rows}
          keyField="ref"
          searchable={false}
          actionLabel={t("apiKeys.new")}
          onAction={() => setCreateOpen(true)}
          columns={[
            {
              key: "accessKeyId",
              header: t("apiKeys.col.accessKeyId"),
              render: (r) => (
                <code className="font-mono text-[13px] text-slate-700">{r.accessKeyId}</code>
              )
            },
            {
              key: "role",
              header: t("apiKeys.col.role"),
              render: (r) => t(`apiKeys.role.${r.role}` as MessageId)
            },
            {
              key: "expiresAt",
              header: t("apiKeys.col.expires"),
              render: (r) => fmtDate(r.expiresAt) ?? t("apiKeys.noExpiry")
            },
            {
              key: "actions",
              header: "",
              align: "right",
              className: "w-px whitespace-nowrap",
              render: (r) => (
                <RowActionsMenu
                  items={[
                    {
                      label: t("apiKeys.actions.regenerate"),
                      onClick: () => setRegenTarget(r.ref)
                    },
                    {
                      label: t("apiKeys.actions.delete"),
                      onClick: () => setDeleteTarget(r.ref),
                      variant: "destructive"
                    }
                  ]}
                />
              )
            }
          ]}
        />
      )}

      {canManage && rows.length === 0 && !list.isLoading && (
        <p className="text-sm text-slate-400">{t("apiKeys.empty")}</p>
      )}

      <CreateApiKeyDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(undefined);
        }}
        onSubmit={onCreate}
        isPending={create.isPending}
        error={createError}
      />

      <ShowSecretDialog credentials={secret} onClose={() => setSecret(null)} />

      <Dialog
        open={!!regenTarget}
        onClose={() => {
          setRegenTarget(null);
          setRegenError(undefined);
        }}
        title={t("apiKeys.regenerate.title")}
        description={regenError ?? t("apiKeys.regenerate.description")}
        confirmLabel={t("apiKeys.regenerate.confirm")}
        cancelLabel={t("common.cancel")}
        onConfirm={onRegenerate}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        title={t("apiKeys.delete.title")}
        description={t("apiKeys.delete.description")}
        isPending={remove.isPending}
      />
    </div>
  );
}
