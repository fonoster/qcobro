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
  render: () => <KpiCard label="Total en mora" value="$12,450,000" subtext="Sobre 340 deudores" />
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

const PERIOD_OPTIONS = [
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 días" },
  { value: "14d", label: "14 días" },
  { value: "28d", label: "28 días" }
];

const periodControl = (value: string) => ({
  value,
  ariaLabel: "Período de tasa de contacto",
  onChange: () => {},
  options: PERIOD_OPTIONS
});

/** The windowed contact-rate card: percentage plus an accounts-reached/sends subline, with
 *  the in-card period pill (calendar icon, current period, chevron). */
export const ContactRateWithPeriod: StoryObj = {
  render: () => (
    <KpiCard
      label="Contacto"
      value="92%"
      subtext="230 de 250 cuentas · 410 envíos"
      period={periodControl("7d")}
    />
  )
};

/** No gestiones in the selected window: "—", never "0%". */
export const ContactRateEmpty: StoryObj = {
  render: () => (
    <KpiCard
      label="Contacto"
      value="—"
      subtext="Sin envíos en el período"
      period={periodControl("24h")}
    />
  )
};

/**
 * The Panel de control row at its real proportions: five cards across the width a 1280px
 * viewport leaves after the sidebar and page padding (~976px). This is the case that catches
 * the label/pill fight — a single wide card hides it entirely — and it's where to check that
 * every card's bottom note still shares one baseline despite the taller contact header.
 */
export const DashboardRowAtNarrowWidth: StoryObj = {
  render: () => (
    <div className="w-[976px]">
      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Recuperado" value="$287,430" subtext="acumulado" />
        <KpiCard label="Promesas cumplidas" value="312" subtext="cumplidas" />
        <KpiCard
          label="Contacto"
          value="92%"
          subtext="230 de 250 cuentas · 410 envíos"
          period={periodControl("7d")}
        />
        <KpiCard label="Saldo pendiente" value="$1,204,900" subtext="por cobrar" />
        <KpiCard label="Cuentas en gestión" value="12,430" subtext="activas" />
      </div>
    </div>
  )
};

export const Row: StoryObj = {
  render: () => (
    <KpiRow
      cards={[
        {
          label: "Deudores activos",
          value: "1,240",
          trend: { value: "+18 esta semana", positive: true }
        },
        {
          label: "Recaudo mes",
          value: "$4.2M",
          trend: { value: "+12%", positive: true },
          subtext: "Meta: $5M"
        },
        { label: "Promesas vigentes", value: "87", trend: { value: "-3 hoy", positive: false } },
        { label: "Tasa de contacto", value: "68%", trend: { value: "+5pp", positive: true } }
      ]}
    />
  )
};
