import type { Meta, StoryObj } from "@storybook/react";
import { CampaignAutopausedBanner } from "./CampaignAutopausedBanner.js";

const meta = {
  title: "Campaigns/CampaignAutopausedBanner",
  component: CampaignAutopausedBanner,
  parameters: { layout: "padded" }
} satisfies Meta<typeof CampaignAutopausedBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
