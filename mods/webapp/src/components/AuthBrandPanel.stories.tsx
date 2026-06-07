import type { Meta, StoryObj } from "@storybook/react";
import { AuthBrandPanel } from "./AuthBrandPanel.js";

const meta: Meta<typeof AuthBrandPanel> = {
  title: "Brand/AuthBrandPanel",
  component: AuthBrandPanel,
  parameters: { layout: "fullscreen" }
};

export default meta;

export const Default: StoryObj<typeof AuthBrandPanel> = {};
