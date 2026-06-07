import type { Meta, StoryObj } from "@storybook/react";
import { StatusStrip } from "./status-strip.js";

const meta = {
  title: "Components/StatusStrip",
  component: StatusStrip,
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta<typeof StatusStrip>;

export default meta;

export const Default: StoryObj = {
  render: () => (
    <StatusStrip
      items={[
        { label: "Al día", value: 420, color: "emerald" },
        { label: "En mora", value: 183, color: "amber" },
        { label: "Crítico", value: 57, color: "red" },
        { label: "Sin gestión", value: 34, color: "gray" }
      ]}
    />
  )
};

export const CampaignStatus: StoryObj = {
  render: () => (
    <StatusStrip
      items={[
        { label: "Activas", value: 3, color: "emerald" },
        { label: "Pausadas", value: 1, color: "amber" },
        { label: "Cerradas", value: 8, color: "gray" }
      ]}
    />
  )
};

export const AgentStatus: StoryObj = {
  render: () => (
    <StatusStrip
      items={[
        { label: "En línea", value: 12, color: "emerald" },
        { label: "En pausa", value: 2, color: "amber" },
        { label: "Desconectados", value: 3, color: "gray" },
        { label: "En alerta", value: 1, color: "red" }
      ]}
    />
  )
};
