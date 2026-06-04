import type { Meta, StoryObj } from "@storybook/react";
import { IconLabel } from "./icon-label.js";
import { Phone, Mail, Calendar, AlertTriangle } from "lucide-react";

const meta = {
  title: "UI/IconLabel",
  component: IconLabel,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof IconLabel>;

export default meta;

export const Default: StoryObj = {
  render: () => <IconLabel icon={<Phone className="h-4 w-4" />}>+57 300 123 4567</IconLabel>
};

export const Success: StoryObj = {
  render: () => (
    <IconLabel variant="success" icon={<Mail className="h-4 w-4" />}>
      correo@ejemplo.com
    </IconLabel>
  )
};

export const Violet: StoryObj = {
  render: () => (
    <IconLabel variant="violet" icon={<Calendar className="h-4 w-4" />}>
      Vence: 15 Jun 2024
    </IconLabel>
  )
};

export const Orange: StoryObj = {
  render: () => (
    <IconLabel variant="orange" icon={<AlertTriangle className="h-4 w-4" />}>
      45 días en mora
    </IconLabel>
  )
};

export const AllVariants: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-3">
      <IconLabel variant="secondary" icon={<Phone className="h-4 w-4" />}>Teléfono</IconLabel>
      <IconLabel variant="success" icon={<Mail className="h-4 w-4" />}>Email</IconLabel>
      <IconLabel variant="violet" icon={<Calendar className="h-4 w-4" />}>Fecha</IconLabel>
      <IconLabel variant="orange" icon={<AlertTriangle className="h-4 w-4" />}>Alerta</IconLabel>
    </div>
  )
};
