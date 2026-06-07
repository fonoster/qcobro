import type { Meta, StoryObj } from "@storybook/react";
import { Plus, Trash2, Download } from "lucide-react";
import { Button, IconButton } from "./button.js";

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: "Button" } };
export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus className="h-4 w-4" /> Button
      </>
    )
  }
};
export const Secondary: Story = { args: { variant: "secondary", children: "Button" } };
export const Outline: Story = { args: { variant: "outline", children: "Button" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Button" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Button" } };
export const Large: Story = { args: { size: "lg", children: "Button" } };
export const Disabled: Story = { args: { disabled: true, children: "Button" } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  )
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="default">Default size</Button>
      <Button size="lg">Large size</Button>
    </div>
  )
};

export const IconButtons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <IconButton>
        <Plus className="h-4 w-4" />
      </IconButton>
      <IconButton variant="secondary">
        <Download className="h-4 w-4" />
      </IconButton>
      <IconButton variant="outline">
        <Download className="h-4 w-4" />
      </IconButton>
      <IconButton variant="ghost">
        <Download className="h-4 w-4" />
      </IconButton>
      <IconButton variant="destructive">
        <Trash2 className="h-4 w-4" />
      </IconButton>
      <IconButton size="lg">
        <Plus className="h-5 w-5" />
      </IconButton>
    </div>
  )
};
