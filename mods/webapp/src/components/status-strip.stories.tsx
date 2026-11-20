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
        { label: "Al día", value: 420 },
        { label: "En mora", value: 183 },
        { label: "Crítico", value: 57 },
        { label: "Sin gestión", value: 34 }
      ]}
    />
  )
};

export const CampaignStatus: StoryObj = {
  render: () => (
    <StatusStrip
      items={[
        { label: "Activas", value: 3 },
        { label: "Pausadas", value: 1 },
        { label: "Cerradas", value: 8 }
      ]}
    />
  )
};

export const AgentStatus: StoryObj = {
  render: () => (
    <StatusStrip
      items={[
        { label: "En línea", value: 12 },
        { label: "En pausa", value: 2 },
        { label: "Desconectados", value: 3 },
        { label: "En alerta", value: 1 }
      ]}
    />
  )
};
