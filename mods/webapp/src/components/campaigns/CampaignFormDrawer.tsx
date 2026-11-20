import { useEffect, useRef, useState, type ReactNode } from "react";
import { Calendar, ChevronsUpDown, Clock, Info, Lock } from "lucide-react";
import { trpc } from "../../lib/trpc.js";
import { useI18n } from "../../lib/i18n.js";
import { useWorkspaceTimezone } from "../../lib/useWorkspaceCurrency.js";
import { toYmd } from "../../lib/campaignSchedule.js";
import { cn } from "../../lib/utils.js";
import { Drawer } from "../ui/drawer.js";
import { DayPicker } from "../ui/day-picker.js";
import { Field, FieldError, FieldLabel, fieldControlClass, fieldErrorClass } from "../ui/field.js";
import { Input, InputGroup } from "../ui/input.js";
import { SelectGroup } from "../ui/select.js";

/** The campaign fields the edit drawer reads (a list row or the detail payload). */
export interface EditableCampaign {
  id: string;
  name: string;
  daysOfWeek: number[];
  startDate: Date | string;
  endDate: Date | string | null;
  startTime: string;
  endTime: string;
  maxAttemptsPerAccount: number;
  maxAttemptsPerDay: number;
  agentTemplate?: { name: string; type: string } | null;
}

type Translate = ReturnType<typeof useI18n>["t"];

/** "Voz IA · Carla": the agent's channel, then its name. */
export function agentLabel(agent: { name: string; type: string } | null | undefined, t: Translate) {
  if (!agent) return "—";
  return `${t(`agents.type.${agent.type}` as Parameters<Translate>[0])} · ${agent.name}`;
}

interface Schedule {
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  maxPerAccount: number;
  maxPerDay: number;
}

type Errors = Partial<
  Record<
    | "name"
    | "portfolios"
    | "agent"
    | "sender"
    | "startDate"
    | "days"
    | "endTime"
    | "maxPerAccount"
    | "maxPerDay",
    string
  >
>;

function validateSchedule(s: Schedule, t: Translate, requireStart: boolean): Errors {
  const e: Errors = {};
  if (requireStart && !s.startDate) e.startDate = t("campaigns.form.noStartDate");
  if (s.daysOfWeek.length === 0) e.days = t("campaigns.form.noDays");
  if (s.startTime >= s.endTime) e.endTime = t("campaigns.form.invalidWindow");
  if (!(s.maxPerAccount >= 1)) e.maxPerAccount = t("campaigns.form.minOne");
  if (!(s.maxPerDay >= 1)) e.maxPerDay = t("campaigns.form.minOne");
  return e;
}

/** An input with a leading lucide icon; for date/time the native picker opens from the icon. */
function IconInput({
  label,
  id,
  icon,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  icon: ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 flex -translate-y-1/2 text-fg-muted [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <Input
          id={id}
          invalid={Boolean(error)}
          className={cn(
            "relative pl-9 font-mono [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
            className
          )}
          {...props}
        />
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** A muted note box (info icon, 12 px muted text). */
function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-control bg-elevated px-3 py-2.5">
      <Info className="mt-px h-3.5 w-3.5 shrink-0 text-fg-muted" />
      <p className="text-xs text-fg-muted">{children}</p>
    </div>
  );
}

/** The read-only agent shown while editing: lock icon on a muted box. */
function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex h-10 items-center gap-2.5 rounded-control border border-border bg-elevated px-3">
        <Lock className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
        <span className="truncate text-sm text-fg-muted">{value}</span>
      </div>
    </div>
  );
}

/** A select-looking button that opens a checkbox list (the campaign's portfolios). */
function PortfolioMultiSelect({
  id,
  label,
  options,
  value,
  onChange,
  error
}: {
  id: string;
  label: string;
  options: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selected = options.filter((o) => value.includes(o.id));
  const summary =
    selected.length === 0
      ? null
      : selected.length === 1
        ? selected[0]!.name
        : t("campaigns.form.portfoliosSelected").replace("{count}", String(selected.length));

  function toggle(pid: string) {
    onChange(value.includes(pid) ? value.filter((x) => x !== pid) : [...value, pid]);
  }

  return (
    <div className="flex flex-col gap-2" ref={ref}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={Boolean(error) || undefined}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            fieldControlClass,
            "flex h-10 cursor-pointer items-center justify-between gap-2 px-3 text-left",
            error && fieldErrorClass
          )}
        >
          <span className={cn("truncate", !summary && "text-fg-subtle")}>
            {summary ?? t("campaigns.form.portfoliosPlaceholder")}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
        </button>
        {open && (
          <div
            role="listbox"
            aria-multiselectable
            aria-label={label}
            className="absolute left-0 right-0 top-full z-20 mt-1 flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-control border border-border bg-surface p-1.5 shadow-lg"
          >
            {options.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-fg hover:bg-elevated"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={value.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** Fechas, Días, Horas, Topes and the time-zone note: shared by create and edit. */
function ScheduleFields({
  prefix,
  s,
  set,
  errors
}: {
  prefix: string;
  s: Schedule;
  set: (patch: Partial<Schedule>) => void;
  errors: Errors;
}) {
  const { t } = useI18n();
  const timeZone = useWorkspaceTimezone();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <IconInput
          label={t("campaigns.form.startDate")}
          id={`${prefix}-start`}
          type="date"
          icon={<Calendar />}
          value={s.startDate}
          error={errors.startDate}
          onChange={(e) => set({ startDate: e.target.value })}
        />
        <IconInput
          label={t("campaigns.form.endDate")}
          id={`${prefix}-end`}
          type="date"
          icon={<Calendar />}
          value={s.endDate}
          onChange={(e) => set({ endDate: e.target.value })}
        />
      </div>

      <Field label={t("campaigns.form.days")} error={errors.days}>
        <DayPicker
          aria-label={t("campaigns.form.days")}
          value={s.daysOfWeek}
          invalid={Boolean(errors.days)}
          onChange={(daysOfWeek) => set({ daysOfWeek })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <IconInput
          label={t("campaigns.form.startTime")}
          id={`${prefix}-startt`}
          type="time"
          icon={<Clock />}
          value={s.startTime}
          onChange={(e) => set({ startTime: e.target.value })}
        />
        <IconInput
          label={t("campaigns.form.endTime")}
          id={`${prefix}-endt`}
          type="time"
          icon={<Clock />}
          value={s.endTime}
          error={errors.endTime}
          onChange={(e) => set({ endTime: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InputGroup
          label={t("campaigns.form.maxPerAccount")}
          id={`${prefix}-maxacc`}
          type="number"
          min={1}
          className="[&_input]:font-mono"
          value={String(s.maxPerAccount)}
          error={errors.maxPerAccount}
          onChange={(e) => set({ maxPerAccount: Number(e.target.value) })}
        />
        <InputGroup
          label={t("campaigns.form.maxPerDay")}
          id={`${prefix}-maxday`}
          type="number"
          min={1}
          className="[&_input]:font-mono"
          value={String(s.maxPerDay)}
          error={errors.maxPerDay}
          onChange={(e) => set({ maxPerDay: Number(e.target.value) })}
        />
      </div>

      {timeZone && <Note>{t("campaigns.form.tzNote").replace("{tz}", timeZone)}</Note>}
    </>
  );
}

const ERROR_FOR: Record<keyof Schedule, keyof Errors | undefined> = {
  startDate: "startDate",
  endDate: undefined,
  daysOfWeek: "days",
  startTime: "endTime",
  endTime: "endTime",
  maxPerAccount: "maxPerAccount",
  maxPerDay: "maxPerDay"
};

/** Schedule state plus field errors; editing a field clears its error (errors show only while wrong). */
function useSchedule(initial: Schedule) {
  const [s, setS] = useState<Schedule>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const set = (patch: Partial<Schedule>) => {
    setS((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(patch) as (keyof Schedule)[]) {
        const ek = ERROR_FOR[k];
        if (ek) delete next[ek];
      }
      return next;
    });
  };
  return { s, set, errors, setErrors };
}

/** Editar campaña: name, schedule and caps. The agent is shown locked; portfolios stay as they are. */
export function EditCampaignDrawer({
  campaign,
  onClose,
  onSuccess
}: {
  campaign: EditableCampaign;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(campaign.name);
  const { s, set, errors, setErrors } = useSchedule({
    startDate: toYmd(campaign.startDate),
    endDate: toYmd(campaign.endDate),
    daysOfWeek: campaign.daysOfWeek ?? [1, 2, 3, 4, 5],
    startTime: campaign.startTime,
    endTime: campaign.endTime,
    maxPerAccount: campaign.maxAttemptsPerAccount,
    maxPerDay: campaign.maxAttemptsPerDay
  });
  const [error, setError] = useState<string | null>(null);

  const update = trpc.campaigns.update.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function handleSave() {
    const e = validateSchedule(s, t, false);
    if (!name.trim()) e.name = t("campaigns.form.noName");
    setErrors(e);
    setError(null);
    if (Object.keys(e).length > 0) return;
    update.mutate({
      id: campaign.id,
      name: name.trim(),
      startDate: s.startDate,
      endDate: s.endDate || undefined,
      daysOfWeek: s.daysOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      maxAttemptsPerAccount: s.maxPerAccount,
      maxAttemptsPerDay: s.maxPerDay
    });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width={560}
      title={t("campaigns.form.editTitle")}
      subtitle={t("campaigns.form.editSubtitle")}
      confirmLabel={update.isPending ? t("common.saving") : t("campaigns.form.save")}
      confirmDisabled={update.isPending}
      onSubmit={handleSave}
      error={error}
    >
      <InputGroup
        label={t("campaigns.form.name")}
        id="e-name"
        value={name}
        error={errors.name}
        onChange={(e) => {
          setName(e.target.value);
          setErrors((prev) => {
            const next = { ...prev };
            delete next.name;
            return next;
          });
        }}
      />
      <LockedField
        label={t("campaigns.form.agentLocked")}
        value={agentLabel(campaign.agentTemplate, t)}
      />
      <ScheduleFields prefix="e" s={s} set={set} errors={errors} />
    </Drawer>
  );
}

/** Nueva campaña: Nombre, Carteras, Agente, [Número de envío], then the schedule. */
export function CreateCampaignDrawer({
  onClose,
  onSuccess
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [portfolioIds, setPortfolioIds] = useState<string[]>([]);
  const [agentTemplateId, setAgentTemplateId] = useState("");
  const [whatsAppSenderNumberId, setWhatsAppSenderNumberId] = useState("");
  const { s, set, errors, setErrors } = useSchedule({
    startDate: "",
    endDate: "",
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "18:00",
    maxPerAccount: 5,
    maxPerDay: 1
  });
  const [error, setError] = useState<string | null>(null);

  const portfolios = trpc.portfolios.list.useQuery();
  const agents = trpc.agentTemplates.list.useQuery();
  const agentList = (agents.data ?? []) as { id: string; name: string; type: string }[];
  const selectedAgent = agentList.find((a) => a.id === agentTemplateId);
  const isWhatsApp = selectedAgent?.type === "WHATSAPP";
  const senders = trpc.whatsAppIntegration.listSenders.useQuery(undefined, {
    enabled: isWhatsApp
  });
  const senderList = (senders.data ?? []) as { id: string; displayNumber: string; label: string }[];

  const create = trpc.campaigns.create.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function clear(key: keyof Errors) {
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  function handleCreate() {
    const e = validateSchedule(s, t, true);
    if (!name.trim()) e.name = t("campaigns.form.noName");
    if (portfolioIds.length === 0) e.portfolios = t("campaigns.form.noPortfolios");
    if (!agentTemplateId) {
      e.agent = agentList.length === 0 ? t("campaigns.form.noAgents") : t("campaigns.form.noAgent");
    }
    if (isWhatsApp && !whatsAppSenderNumberId) e.sender = t("campaigns.form.noWhatsAppSender");
    setErrors(e);
    setError(null);
    if (Object.keys(e).length > 0) return;
    create.mutate({
      name: name.trim(),
      portfolioIds,
      agentTemplateId,
      startDate: s.startDate,
      endDate: s.endDate || undefined,
      daysOfWeek: s.daysOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      maxAttemptsPerAccount: s.maxPerAccount,
      maxAttemptsPerDay: s.maxPerDay,
      ...(isWhatsApp && whatsAppSenderNumberId ? { whatsAppSenderNumberId } : {})
    });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width={560}
      title={t("campaigns.new")}
      subtitle={t("campaigns.form.createSubtitle")}
      confirmLabel={create.isPending ? t("common.creating") : t("campaigns.form.create")}
      confirmDisabled={create.isPending}
      onSubmit={handleCreate}
      error={error}
    >
      <InputGroup
        label={t("campaigns.form.name")}
        id="c-name"
        placeholder={t("campaigns.form.namePlaceholder")}
        value={name}
        error={errors.name}
        onChange={(e) => {
          setName(e.target.value);
          clear("name");
        }}
      />

      <PortfolioMultiSelect
        id="c-portfolios"
        label={t("campaigns.form.portfolios")}
        options={(portfolios.data ?? []) as { id: string; name: string }[]}
        value={portfolioIds}
        error={errors.portfolios}
        onChange={(ids) => {
          setPortfolioIds(ids);
          clear("portfolios");
        }}
      />

      <SelectGroup
        label={t("campaigns.form.agent")}
        id="c-agent"
        value={agentTemplateId}
        error={errors.agent}
        className={cn(!agentTemplateId && "[&_select]:text-fg-subtle")}
        onChange={(e) => {
          setAgentTemplateId(e.target.value);
          setWhatsAppSenderNumberId("");
          clear("agent");
          clear("sender");
        }}
      >
        <option value="">{t("campaigns.form.agentPlaceholder")}</option>
        {agentList.map((a) => (
          <option key={a.id} value={a.id} className="text-fg">
            {agentLabel(a, t)}
          </option>
        ))}
      </SelectGroup>

      {isWhatsApp && (
        <SelectGroup
          label={t("campaigns.form.whatsAppSender")}
          id="c-wa-sender"
          value={whatsAppSenderNumberId}
          error={
            errors.sender ??
            (!senders.isLoading && senderList.length === 0
              ? t("campaigns.form.noWhatsAppSender")
              : undefined)
          }
          onChange={(e) => {
            setWhatsAppSenderNumberId(e.target.value);
            clear("sender");
          }}
        >
          <option value="">{t("campaigns.form.senderPlaceholder")}</option>
          {senderList.map((sn) => (
            <option key={sn.id} value={sn.id}>
              {sn.displayNumber} · {sn.label}
            </option>
          ))}
        </SelectGroup>
      )}

      <ScheduleFields prefix="c" s={s} set={set} errors={errors} />
    </Drawer>
  );
}
