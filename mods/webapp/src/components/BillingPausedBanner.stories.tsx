import type { Meta, StoryObj } from "@storybook/react";
import { BillingPausedBanner } from "./BillingPausedBanner.js";

const meta = {
  title: "Billing/BillingPausedBanner",
  component: BillingPausedBanner,
  parameters: { layout: "padded" }
} satisfies Meta<typeof BillingPausedBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreditsExhaustedOwner: Story = {
  args: { variant: "credits_exhausted", isOwner: true, onAction: () => {} }
};

export const CreditsExhaustedAdmin: Story = {
  args: { variant: "credits_exhausted", isOwner: false }
};

export const PaymentFailedOwner: Story = {
  args: { variant: "payment_failed", isOwner: true, onAction: () => {} }
};
