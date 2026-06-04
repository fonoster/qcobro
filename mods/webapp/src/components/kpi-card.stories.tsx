import type { Meta, StoryObj } from "@storybook/react";
import { KpiCard, KpiRow } from "./kpi-card.js";

const meta = {
  title: "Components/KpiCard",
  component: KpiCard,
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta<typeof KpiCard>;

export default meta;

export const Default: StoryObj = {
  render: () => (
    <KpiCard
      label="Total en mora"
      value="$12,450,000"
      subtext="Sobre 340 deudores"
    />
  )
};

export const WithPositiveTrend: StoryObj = {
  render: () => (
    <KpiCard
      label="Recaudo del mes"
      value="$4,230,000"
      trend={{ value: "+12% vs mes anterior", positive: true }}
      subtext="Meta: $5,000,000"
    />
  )
};

export const WithNegativeTrend: StoryObj = {
  render: () => (
    <KpiCard
      label="Tasa de mora"
      value="34.2%"
      trend={{ value: "+2.1pp este mes", positive: false }}
      subtext="Umbral: 30%"
    />
  )
};

export const Row: StoryObj = {
  render: () => (
    <KpiRow
      cards={[
        { label: "Deudores activos", value: "1,240", trend: { value: "+18 esta semana", positive: true } },
        { label: "Recaudo mes", value: "$4.2M", trend: { value: "+12%", positive: true }, subtext: "Meta: $5M" },
        { label: "Promesas vigentes", value: "87", trend: { value: "-3 hoy", positive: false } },
        { label: "Tasa de contacto", value: "68%", trend: { value: "+5pp", positive: true } }
      ]}
    />
  )
};
