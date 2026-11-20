import type { ComponentType } from "react";
import { Bot, AudioLines, MessageSquare, Mail, MessageCircle } from "lucide-react";

/** Channel of the agent that reached out — mirrors `agentTypeSchema` in @qcobro/common. */
export type Channel = "VOICE_AI" | "VOICE_PRERECORDED" | "SMS" | "EMAIL" | "WHATSAPP";

/**
 * Single source of truth for channel icons. A gestión's icon must match the channel of the
 * agent that reached out, so Gestiones, Agentes, Campañas and Inicio share this map — one
 * distinct icon per channel (SMS and WhatsApp must not collide).
 */
const CHANNEL_ICON: Record<Channel, ComponentType<{ className?: string }>> = {
  VOICE_AI: Bot,
  VOICE_PRERECORDED: AudioLines,
  SMS: MessageSquare,
  EMAIL: Mail,
  WHATSAPP: MessageCircle
};

export function channelIcon(channel: string): ComponentType<{ className?: string }> {
  return CHANNEL_ICON[channel as Channel] ?? MessageSquare;
}
