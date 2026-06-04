import type { Meta, StoryObj } from "@storybook/react";
import { Alert } from "./alert.js";

const meta = {
  title: "UI/Alert",
  component: Alert,
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Error: Story = {
  args: { variant: "error", title: "Communication link lost", description: "Rover telemetry signal interrupted. Check your base antenna alignment or retry connection in 10 minutes." }
};
export const Success: Story = {
  args: { variant: "success", title: "Changes saved", description: "Your configuration has been saved successfully." }
};
export const Warning: Story = {
  args: { variant: "warning", title: "Low balance", description: "Your account balance is below the minimum threshold." }
};
export const Info: Story = {
  args: { variant: "info", title: "New feature available", description: "AI agent integration is now available for your account." }
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-96">
      <Alert variant="error" title="Error" description="Something went wrong." />
      <Alert variant="success" title="Success" description="Action completed." />
      <Alert variant="warning" title="Warning" description="Please review this." />
      <Alert variant="info" title="Info" description="Here is some information." />
    </div>
  )
};
