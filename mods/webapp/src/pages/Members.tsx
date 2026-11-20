import { useState, type FormEvent } from "react";
import { Ban, Mail, Send, UserMinus, UserPlus } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { Button } from "../components/ui/button.js";
import { Dialog } from "../components/ui/dialog.js";
import { InputGroup, SearchBox } from "../components/ui/input.js";
import { ChoiceCardGroup } from "../components/ui/choice-cards.js";
import { DataTable, TableCount } from "../components/ui/data-table.js";
import { FilterChip } from "../components/ui/filter-chip.js";
import { RowActionsMenu, type RowAction } from "../components/ui/row-actions-menu.js";
import { PageHeader } from "../components/page-header.js";
import { useI18n, type MessageId } from "../lib/i18n.js";
import { isWorkspaceAdmin } from "../lib/workspaceRole.js";

type Row = {
  ref: string;
  name: string;
  email: string;
  role: string;
  status: string;
  removable: boolean;
};

type InviteRole = "WORKSPACE_MEMBER" | "WORKSPACE_ADMIN";

const PAGE_SIZE = 10;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/** Avatar initials (32, --secondary) + name 14/500 + email 12 muted. */
function MemberCell({ name, email }: { name: string; email: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-[11px] font-semibold text-fg"
      >
        {initials(name)}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-fg">{name}</span>
        <span className="truncate text-xs font-normal text-fg-muted">{email}</span>
      </div>
    </div>
  );
}

export function Members() {
  const { t } = useI18n();
  const { workspace, accessToken } = useAuth();
  const utils = trpc.useUtils();
  const workspaces = trpc.workspaces.list.useQuery();
  const members = trpc.workspaces.listMembers.useQuery();
  const invite = trpc.workspaces.invite.useMutation();
  const remove = trpc.workspaces.removeMember.useMutation();
  const resend = trpc.workspaces.resendInvitation.useMutation();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("WORKSPACE_MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    message: string;
    confirmLabel: string;
    run: () => Promise<void>;
  }>(null);

  const activeWorkspace = workspaces.data?.items.find((w) => w.accessKeyId === workspace);
  const wsName = activeWorkspace?.name ?? t("members.wsFallback");

  // Any workspace member can view the roster (listMembers is workspaceProcedure), but
  // invite/resend/remove are all adminProcedure server-side. Gate their affordances so a
  // non-admin never sees a control that would only be rejected on click. UI-only — the
  // apiserver still enforces every one of these.
  const canManage = isWorkspaceAdmin(accessToken, workspace);

  // The owner isn't a member row in Identity — build their row from the workspace's own
  // owner record. Whoever is viewing this page isn't necessarily the owner (admins can
  // view Members too), so the owner row must never be built from the viewer's identity.
  const ownerRow: Row | null = activeWorkspace?.owner
    ? {
        ref: "owner",
        name: activeWorkspace.owner.name,
        email: activeWorkspace.owner.email,
        role: "WORKSPACE_OWNER",
        status: "ACTIVE",
        removable: false
      }
    : null;
  const rows: Row[] = [
    ...(ownerRow ? [ownerRow] : []),
    ...(members.data?.items ?? []).map((m) => ({
      ref: m.userRef,
      name: m.name || m.email,
      email: m.email,
      role: m.role,
      status: m.status,
      removable: true
    }))
  ];

  const query = search.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      (!roleFilter || r.role === roleFilter) &&
      (!query || r.name.toLowerCase().includes(query) || r.email.toLowerCase().includes(query))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function closeInvite() {
    setOpen(false);
    setName("");
    setEmail("");
    setRole("WORKSPACE_MEMBER");
    setError(null);
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await invite.mutateAsync({ name, email, role });
      await utils.workspaces.listMembers.invalidate();
      closeInvite();
    } catch {
      setError(t("members.invite.error"));
    }
  }

  async function onRemove(userRef: string) {
    await remove.mutateAsync({ userRef });
    await utils.workspaces.listMembers.invalidate();
  }

  async function onResend(userRef: string) {
    await resend.mutateAsync({ userRef });
  }

  function askRemove(r: Row) {
    setConfirm({
      title: t("members.remove.title").replace("{name}", r.name),
      message: t("members.remove.message").replace("{ws}", wsName),
      confirmLabel: t("members.remove.confirm"),
      run: () => onRemove(r.ref)
    });
  }

  function askCancel(r: Row) {
    setConfirm({
      title: t("members.cancelInvite.title"),
      message: t("members.cancelInvite.message").replace("{name}", r.name),
      confirmLabel: t("members.action.cancelInvite"),
      run: () => onRemove(r.ref)
    });
  }

  function rowActions(r: Row): RowAction[] {
    return r.status === "PENDING"
      ? [
          { icon: Mail, label: t("members.action.resend"), onClick: () => void onResend(r.ref) },
          { icon: Ban, label: t("members.action.cancelInvite"), onClick: () => askCancel(r) }
        ]
      : [{ icon: UserMinus, label: t("members.action.remove"), onClick: () => askRemove(r) }];
  }

  const roleLabel = (role: string) => t(`members.role.${role}` as MessageId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("members.title")}
        description={
          canManage ? t("members.subtitle").replace("{ws}", wsName) : t("members.viewerNotice")
        }
        actions={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <UserPlus className="h-4 w-4" />
              {t("members.invite")}
            </Button>
          )
        }
      />

      <DataTable
        data={pageRows}
        keyField="ref"
        rowHeight={64}
        filterElement={
          <SearchBox
            className="w-80"
            placeholder={t("members.search")}
            aria-label={t("members.search")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        }
        filters={
          <FilterChip
            label={t("members.filter.role")}
            value={roleFilter}
            onChange={(v) => {
              setRoleFilter(v);
              setPage(1);
            }}
            options={[
              { value: "", label: t("members.filter.all") },
              { value: "WORKSPACE_OWNER", label: roleLabel("WORKSPACE_OWNER") },
              { value: "WORKSPACE_ADMIN", label: roleLabel("WORKSPACE_ADMIN") },
              { value: "WORKSPACE_MEMBER", label: roleLabel("WORKSPACE_MEMBER") }
            ]}
          />
        }
        toolbarEnd={
          <TableCount>
            {`${filtered.length} ${t(filtered.length === 1 ? "members.countLabelOne" : "members.countLabel")}`}
          </TableCount>
        }
        page={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalRecords={members.isLoading ? undefined : filtered.length}
        pageSize={PAGE_SIZE}
        itemLabel={t("members.countLabel")}
        columns={[
          {
            key: "name",
            header: t("members.col.member"),
            render: (r) => <MemberCell name={r.name} email={r.email} />
          },
          {
            key: "role",
            header: t("members.col.role"),
            width: 160,
            render: (r) => roleLabel(r.role)
          },
          {
            key: "status",
            header: t("members.col.status"),
            width: 180,
            render: (r) => t(`members.status.${r.status}` as MessageId)
          },
          {
            key: "actions",
            header: "",
            align: "right",
            width: 56,
            render: (r) =>
              canManage && r.removable ? <RowActionsMenu items={rowActions(r)} /> : null
          }
        ]}
      />

      <Dialog
        open={canManage && open}
        onClose={closeInvite}
        width={480}
        title={t("members.invite")}
        subtitle={t("members.inviteModal.desc").replace("{ws}", wsName)}
        confirmLabel={t("members.inviteSubmit")}
        confirmIcon={<Send className="h-4 w-4" />}
        confirmDisabled={invite.isPending}
        onSubmit={onInvite}
      >
        <InputGroup
          id="invite-name"
          label={t("members.field.name")}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("members.field.namePlaceholder")}
          autoFocus
        />
        <InputGroup
          id="invite-email"
          label={t("members.field.email")}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("members.field.emailPlaceholder")}
          error={error ?? undefined}
        />
        <ChoiceCardGroup
          label={t("members.field.role")}
          vertical
          value={role}
          onChange={setRole}
          options={[
            {
              value: "WORKSPACE_MEMBER",
              title: roleLabel("WORKSPACE_MEMBER"),
              description: t("members.role.WORKSPACE_MEMBER.desc")
            },
            {
              value: "WORKSPACE_ADMIN",
              title: roleLabel("WORKSPACE_ADMIN"),
              description: t("members.role.WORKSPACE_ADMIN.desc")
            }
          ]}
        />
      </Dialog>

      <Dialog
        open={canManage && !!confirm}
        onClose={() => setConfirm(null)}
        width={440}
        title={confirm?.title}
        confirmVariant="destructive"
        confirmLabel={confirm?.confirmLabel}
        confirmDisabled={remove.isPending}
        onConfirm={async () => {
          await confirm?.run();
          setConfirm(null);
        }}
      >
        <p className="text-[13px] text-fg-muted">{confirm?.message}</p>
      </Dialog>
    </div>
  );
}
