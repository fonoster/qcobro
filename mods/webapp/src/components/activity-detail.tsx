import { useEffect, useRef, useState } from "react";
import { X, Phone, Sparkles, Timer, MessageSquare, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { trpc } from "@/lib/trpc.js";
import { formatDate, formatMoney } from "@qcobro/common";
import { Badge } from "@/components/ui/badge.js";
import { t } from "@/lib/i18n.js";

type BadgeVariant = "success" | "orange" | "violet" | "secondary" | "destructive";

function sentimentVariant(s: string | null): BadgeVariant {
  if (!s) return "secondary";
  if (s === "Cooperativo") return "success";
  if (s === "Resistente") return "destructive";
  return "secondary";
}

function resultVariant(r: string | null): BadgeVariant {
  if (!r) return "secondary";
  if (r === "Contacto efectivo" || r === "Promesa de pago") return "success";
  if (r === "Rechazado") return "destructive";
  return "secondary";
}

interface ChannelData {
  recordingUrl?: string;
  transcript?: { role: "ai" | "debtor"; text: string }[];
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  deliveryStatus?: string;
  openCount?: number;
  messages?: { role: "qcobro" | "debtor"; text: string }[];
}

function fmt(s: number): string {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function VoiceCard({ data }: { data: ChannelData }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onDuration = () => { if (isFinite(el.duration)) setDuration(el.duration); };
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onDuration);
    el.addEventListener("durationchange", onDuration);
    el.addEventListener("ended", onEnded);
    // if metadata already available (cached)
    if (isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onDuration);
      el.removeEventListener("durationchange", onDuration);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) { el.pause(); setIsPlaying(false); }
    else { el.play(); setIsPlaying(true); }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  function skip(delta: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(duration, el.currentTime + delta));
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {data.recordingUrl && (
        <audio ref={audioRef} src={data.recordingUrl} preload="auto" />
      )}

      <div className="rounded-[10px] bg-[#1A1A1A] p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#064E3B] shrink-0">
            <Phone className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-white">Grabación de llamada</span>
            <span className="text-xs text-[#999]">
              {duration > 0 ? `Duración: ${fmt(duration)}` : "Cargando…"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div
            className="relative h-1 w-full rounded-sm bg-[#333] cursor-pointer"
            onClick={seek}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-sm bg-[#064E3B] transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[11px] text-[#999]">{fmt(currentTime)}</span>
            <span className="text-[11px] text-[#999]">{fmt(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button onClick={() => skip(-10)} className="text-[#999] hover:text-white transition-colors">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={togglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#064E3B] hover:bg-[#065f46] transition-colors"
          >
            {isPlaying
              ? <Pause className="h-4 w-4 text-white" />
              : <Play className="h-4 w-4 text-white" />}
          </button>
          <button onClick={() => skip(10)} className="text-[#999] hover:text-white transition-colors">
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
      </div>

      {data.transcript && data.transcript.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-[15px] font-semibold text-slate-900">Transcripción de la llamada</span>
          {data.transcript.map((msg, i) => (
            <div key={i} className={`flex flex-col gap-1 ${msg.role === "debtor" ? "items-end" : "items-start"}`}>
              <span className={`text-[11px] font-semibold ${msg.role === "ai" ? "text-[#064E3B]" : "text-slate-500"}`}>
                {msg.role === "ai" ? "AI" : "Deudor"}
              </span>
              <div
                className={`max-w-[380px] rounded-xl px-3 py-2 text-[13px] leading-relaxed text-slate-900 ${
                  msg.role === "ai"
                    ? "rounded-tl-[2px] bg-[#ECFDF5]"
                    : "rounded-tr-[2px] bg-slate-100"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmailCard({ data }: { data: ChannelData }) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3">
        {[
          { label: "De:", value: data.from },
          { label: "Para:", value: data.to },
          { label: "Asunto:", value: data.subject }
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 w-14 shrink-0">{label}</span>
            <span className="text-[13px] text-slate-900">{value ?? "—"}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
        {(data.body ?? "").split("\n\n").map((para, i) => (
          <p key={i} className="text-[13px] leading-relaxed text-slate-900 whitespace-pre-line">{para}</p>
        ))}
      </div>
    </div>
  );
}

function MessageThread({ data, isWhatsapp }: { data: ChannelData; isWhatsapp: boolean }) {
  const msgs = data.messages ?? [];
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[#064E3B]" />
        <span className="text-sm font-medium text-slate-900">
          {isWhatsapp ? "Conversación WhatsApp" : "Conversación SMS"}
        </span>
      </div>
      {msgs.map((msg, i) => (
        <div key={i} className={`flex flex-col gap-1 ${msg.role === "debtor" ? "items-end" : "items-start"}`}>
          <span className={`text-[11px] font-semibold ${msg.role === "qcobro" ? "text-[#064E3B]" : "text-slate-500"}`}>
            {msg.role === "qcobro" ? "QCobro" : "Deudor"}
          </span>
          <div
            className={`max-w-[340px] rounded-xl px-3 py-2 text-[13px] leading-relaxed text-slate-900 ${
              msg.role === "qcobro"
                ? "rounded-tl-[2px] bg-[#ECFDF5]"
                : "rounded-tr-[2px] bg-slate-100"
            }`}
          >
            {msg.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <span className="text-[13px] text-slate-900">{value ?? "—"}</span>
    </div>
  );
}

interface Props {
  activityId: string;
  onClose: () => void;
}

const OUTCOME_VARIANTS = {
  CONTACTED: "success",
  NOT_CONTACTED: "secondary",
  PROMISE: "violet",
  REJECTED: "destructive",
  PENDING: "orange"
} as const;

const VOICE_CHANNELS = new Set(["VOICE_AI", "VOICE", "CALL"]);

export function ActivityDetail({ activityId, onClose }: Props) {
  const { data } = trpc.activities.get.useQuery({ id: activityId });
  const [open, setOpen] = useState(false);
  const [called, setCalled] = useState(false);

  const makeCall = trpc.calls.make.useMutation({
    onSuccess: () => setCalled(true)
  });

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);

  function handleClose() {
    setOpen(false);
    setTimeout(onClose, 200);
  }

  const isVoice = data ? VOICE_CHANNELS.has(data.channel) : false;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />
      <div
        className={`relative ml-auto flex h-full w-[520px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-semibold text-slate-900">Detalle de gestión</span>
            {data && (
              <span className="text-[13px] text-slate-500">
                {data.account?.fullName ?? "—"} — {formatDate(data.createdAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isVoice && (
              <button
                onClick={() => !called && makeCall.mutate({ accountId: data!.accountId })}
                disabled={makeCall.isPending || called}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  called
                    ? "bg-[#ECFDF5] text-[#064E3B] cursor-default"
                    : "bg-[#064E3B] text-white hover:bg-[#065f46] disabled:opacity-60"
                }`}
              >
                <Phone className="h-3.5 w-3.5" />
                {called ? "Enviada" : makeCall.isPending ? "Llamando…" : "Llamar"}
              </button>
            )}
            <button onClick={handleClose} className="rounded-md p-1 text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!data ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">Cargando…</div>
          ) : (
            <div className="flex flex-col gap-5 p-6">
              <ChannelSection activity={data} />
              <AiSection activity={data} />
              <div className="h-px bg-slate-200" />
              <div className="flex flex-col gap-3">
                <span className="text-[15px] font-semibold text-slate-900">Metadatos</span>
                <div className="flex gap-4">
                  <div className="flex flex-1 flex-col gap-3.5">
                    <MetaItem label="Fecha" value={formatDate(data.createdAt)} />
                    <MetaItem label="Campaña" value={(data as any).campaign?.name ?? "—"} />
                    <MetaItem label="Monto" value={data.debtAmount ? formatMoney(data.debtAmount) : "—"} />
                  </div>
                  <div className="flex flex-1 flex-col gap-3.5">
                    <MetaItem label="Canal" value={t.common.channel[data.channel as keyof typeof t.common.channel] ?? data.channel} />
                    <MetaItem label="Agente" value={(data as any).agentId ?? "Sin asignar"} />
                    <MetaItem
                      label="Estado final"
                      value={
                        <Badge variant={OUTCOME_VARIANTS[data.outcome as keyof typeof OUTCOME_VARIANTS] ?? "secondary"}>
                          {t.common.outcome[data.outcome as keyof typeof t.common.outcome] ?? data.outcome}
                        </Badge>
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelSection({ activity }: { activity: any }) {
  const channel = activity.channel as string;
  const parsed: ChannelData = activity.channelData ? JSON.parse(activity.channelData) : {};

  if (channel === "VOICE_AI" || channel === "VOICE" || channel === "CALL") {
    return <VoiceCard data={parsed} />;
  }
  if (channel === "EMAIL") {
    return <EmailCard data={parsed} />;
  }
  if (channel === "WHATSAPP") {
    return <MessageThread data={parsed} isWhatsapp />;
  }
  if (channel === "SMS") {
    return <MessageThread data={parsed} isWhatsapp={false} />;
  }
  return null;
}

function AiSection({ activity }: { activity: any }) {
  const channel = activity.channel as string;
  const isEmail = channel === "EMAIL";
  const isVoice = channel === "VOICE_AI" || channel === "VOICE" || channel === "CALL";
  const parsed: ChannelData = activity.channelData ? JSON.parse(activity.channelData) : {};

  const title = isEmail
    ? "Análisis del email (AI Insights)"
    : channel === "SMS"
    ? "Análisis del SMS (AI Insights)"
    : channel === "WHATSAPP"
    ? "Análisis del WhatsApp (AI Insights)"
    : "Análisis de la gestión (AI Insights)";

  if (!activity.aiSummary && !activity.aiResult && !activity.aiNextStep) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-[18px] w-[18px] text-[#064E3B]" />
        <span className="text-[15px] font-semibold text-slate-900">{title}</span>
      </div>

      {activity.aiSummary && (
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-slate-500">Resumen</span>
          <p className="text-[13px] leading-relaxed text-slate-900">{activity.aiSummary}</p>
        </div>
      )}

      {isEmail ? (
        <>
          {parsed.deliveryStatus && (
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-500">Estado de entrega</span>
              <Badge variant="success">{parsed.deliveryStatus === "DELIVERED" ? "Entregado" : parsed.deliveryStatus}</Badge>
            </div>
          )}
          {parsed.openCount !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-500">Abierto por el destinatario</span>
              <Badge variant="orange">Sí ({parsed.openCount} {parsed.openCount === 1 ? "vez" : "veces"})</Badge>
            </div>
          )}
        </>
      ) : (
        <>
          {activity.aiSentiment && (
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-500">Sentimiento del deudor</span>
              <Badge variant={sentimentVariant(activity.aiSentiment)}>{activity.aiSentiment}</Badge>
            </div>
          )}
          {isVoice && activity.aiDebtReason && (
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-slate-500">Motivo de mora detectado</span>
              <p className="text-[13px] leading-relaxed text-slate-900">{activity.aiDebtReason}</p>
            </div>
          )}
          {activity.aiResult && (
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-500">Resultado de la gestión</span>
              <Badge variant={resultVariant(activity.aiResult)}>{activity.aiResult}</Badge>
            </div>
          )}
        </>
      )}

      {activity.aiNextStep && (
        <div className="rounded-lg bg-amber-50 p-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 text-amber-700" />
            <span className="text-[12px] font-semibold text-amber-700">Próximo paso sugerido</span>
          </div>
          <p className="text-[13px] leading-relaxed text-slate-900">{activity.aiNextStep}</p>
        </div>
      )}
    </div>
  );
}
