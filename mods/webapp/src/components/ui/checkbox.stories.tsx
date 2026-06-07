import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./checkbox.js";

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Checkbox>;

export default meta;

export const Default: StoryObj = { render: () => <Checkbox label="Accept terms" id="terms" /> };
export const Checked: StoryObj = {
  render: () => <Checkbox label="Accept terms" id="terms-c" defaultChecked />
};
export const WithDescription: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Checkbox
        label="Email notifications"
        description="Receive daily digest of collection activity"
        id="notif"
      />
      <Checkbox
        label="SMS alerts"
        description="Get instant alerts for payment promises"
        id="sms"
        defaultChecked
      />
    </div>
  )
};
