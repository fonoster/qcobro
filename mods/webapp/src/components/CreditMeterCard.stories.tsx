import type { Meta, StoryObj } from "@storybook/react";
import { CreditMeterCard } from "./CreditMeterCard.js";

const meta = {
  title: "Billing/CreditMeterCard",
  component: CreditMeterCard,
  parameters: { layout: "padded" }
} satisfies Meta<typeof CreditMeterCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
  args: {
    planName: "Crecimiento",
    balance: "16.20",
    allowance: "29.00",
    remainingFraction: 16.2 / 29,
    renewsAt: "2026-08-01T00:00:00.000Z",
    projectedDaysRemaining: 12,
    language: "es"
  }
};

export const RunningLow: Story = {
  args: {
    ...Healthy.args,
    balance: "2.10",
    remainingFraction: 2.1 / 29,
    projectedDaysRemaining: 2
  }
};

export const FreshCycleNoUsage: Story = {
  args: {
    ...Healthy.args,
    balance: "29.00",
    remainingFraction: 1,
    projectedDaysRemaining: null
  }
};
