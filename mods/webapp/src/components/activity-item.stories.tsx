import type { Meta, StoryObj } from "@storybook/react";
import { ActivityItem } from "./activity-item.js";
import { Phone } from "lucide-react";

const meta = {
  title: "Components/ActivityItem",
  component: ActivityItem,
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta<typeof ActivityItem>;

export default meta;

export const Default: StoryObj = {
  render: () => (
    <ActivityItem
      actor="María López"
      action="registró una promesa de pago para"
      target="Carlos Ruiz"
      timestamp="Hace 5 minutos"
    />
  )
};

export const WithIcon: StoryObj = {
  render: () => (
    <ActivityItem
      icon={<span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100"><Phone className="h-3.5 w-3.5 text-emerald-600" /></span>}
      actor="Sistema"
      action="realizó llamada automática a"
      target="Luis Torres"
      timestamp="Hace 12 minutos"
    />
  )
};

export const NoActor: StoryObj = {
  render: () => (
    <ActivityItem
      action="Promesa de pago vencida sin cumplir"
      target="Ana Gómez"
      timestamp="Ayer a las 18:00"
    />
  )
};

export const Feed: StoryObj = {
  render: () => (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white px-4">
      <ActivityItem actor="Carlos Ruiz" action="cumplió promesa de pago" timestamp="Hace 2 min" />
      <ActivityItem actor="María López" action="gestionó" target="Pedro Castro" timestamp="Hace 8 min" />
      <ActivityItem actor="Ana Gómez" action="registró incumplimiento para" target="Luis Torres" timestamp="Hace 15 min" />
      <ActivityItem actor="Sistema" action="envió SMS masivo a 48 deudores" timestamp="Hace 1 hora" />
    </div>
  )
};
