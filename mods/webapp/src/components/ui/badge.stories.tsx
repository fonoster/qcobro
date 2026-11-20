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

export const Secondary: Story = { args: { variant: "secondary", children: "Cerrado" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Vencido" } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary">Cerrado</Badge>
      <Badge variant="destructive">Vencido</Badge>
    </div>
  )
};
