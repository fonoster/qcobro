import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge.js";

const meta = {
  title: "UI/Badge",
  component: Badge,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = { args: { variant: "success", children: "Activo" } };
export const Orange: Story = { args: { variant: "orange", children: "Pendiente" } };
export const Violet: Story = { args: { variant: "violet", children: "Moderado" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Cerrado" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Vencido" } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="success">Activo</Badge>
      <Badge variant="orange">Pendiente</Badge>
      <Badge variant="violet">Moderado</Badge>
      <Badge variant="secondary">Cerrado</Badge>
      <Badge variant="destructive">Vencido</Badge>
    </div>
  )
};
