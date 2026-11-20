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
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { KeyRound, Plus, Terminal } from "lucide-react";
import { CreateApiKeyDialog } from "../components/CreateApiKeyDialog.js";
import { ShowSecretDialog, type ApiKeyCredentials } from "../components/ShowSecretDialog.js";

type Row = {
  ref: string;
  accessKeyId: string;
  role: string;
  createdAt?: number | string | null;
  expiresAt?: number | string | null;
};

export function ApiKeys() {
  const { t, language } = useI18n();
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

  // Returns a localized "12 ene. 2026"-style date, or null when the value is
  // absent or implausible. Identity returns these timestamps in epoch SECONDS
  // (widen to ms).
  function fmtDate(v: number | string | null | undefined): string | null {
    if (v === null || v === undefined || v === "") return null;
    let value: number | string = v;
    if (typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
    if (typeof value === "number" && value < 1e12) value = value * 1000;
    const d = new Date(value);
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(d);
  }

  function isExpired(v: number | string | null | undefined): boolean {
    if (v === null || v === undefined || v === "") return false;
    let value: number | string = v;
    if (typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
    if (typeof value === "number" && value < 1e12) value = value * 1000;
    const ms = new Date(value).getTime();
    return !Number.isNaN(ms) && ms <= Date.now();
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
    createdAt: k.createdAt,
    expiresAt: k.expiresAt
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("apiKeys.title")}
        description={t("apiKeys.description")}
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("apiKeys.new")}
            </Button>
          ) : undefined
        }
      />

      {!canManage ? (
        <EmptyState icon={<KeyRound />} title={t("apiKeys.adminOnly")} />
      ) : (
        <DataTable
          data={rows}
          keyField="ref"
          searchable={false}
          rowHeight={56}
          empty={
            list.isLoading ? undefined : (
              <EmptyState
                icon={<KeyRound />}
                title={t("apiKeys.empty")}
                body={t("apiKeys.emptyBody")}
              />
            )
          }
          columns={[
            {
              key: "accessKeyId",
              header: t("apiKeys.col.accessKeyId"),
              render: (r) => (
                <code className="font-mono text-[13px] font-normal text-fg">{r.accessKeyId}</code>
              )
            },
            {
              key: "role",
              header: t("apiKeys.col.role"),
              width: 160,
              render: (r) => (
                <Badge className="rounded-md px-2 py-0.5 text-xs">
                  {t(`apiKeys.role.${r.role}` as MessageId)}
                </Badge>
              )
            },
            {
              key: "createdAt",
              header: t("apiKeys.col.created"),
              width: 140,
              render: (r) => <span className="text-fg-muted">{fmtDate(r.createdAt) ?? "—"}</span>
            },
            {
              key: "expiresAt",
              header: t("apiKeys.col.expires"),
              width: 140,
              render: (r) =>
                isExpired(r.expiresAt) ? (
                  t("apiKeys.expired")
                ) : (
                  <span className="text-fg-muted">
                    {fmtDate(r.expiresAt) ?? t("apiKeys.noExpiry")}
                  </span>
                )
            },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 56,
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

      {canManage && (
        <div className="flex flex-wrap items-center gap-2.5">
          <Terminal className="h-3.5 w-3.5 text-fg-muted" />
          <span className="text-xs text-fg-muted">{t("apiKeys.sdkHint")}</span>
          <code className="rounded-md bg-elevated px-2 py-[3px] font-mono text-xs text-fg">
            {"new Client({ accessKeyId, accessKeySecret })"}
          </code>
        </div>
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
        width={480}
        description={t("apiKeys.regenerate.description")}
        error={regenError}
        confirmLabel={t("apiKeys.regenerate.confirm")}
        confirmDisabled={regenerate.isPending}
        onConfirm={onRegenerate}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        title={t("apiKeys.delete.title")}
        description={t("apiKeys.delete.description")}
        confirmLabel={t("apiKeys.delete.confirm")}
        isPending={remove.isPending}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-fg-muted">{t("apiKeys.delete.keyLabel")}</span>
          <code className="rounded-md bg-elevated px-2 py-[3px] font-mono text-xs text-fg">
            {rows.find((r) => r.ref === deleteTarget)?.accessKeyId}
          </code>
        </div>
      </ConfirmDeleteDialog>
    </div>
  );
}
