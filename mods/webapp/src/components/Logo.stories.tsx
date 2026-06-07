import type { Meta, StoryObj } from "@storybook/react";
import { Logo } from "./Logo.js";

const meta: Meta<typeof Logo> = {
  title: "Brand/Logo",
  component: Logo
};

export default meta;

export const Default: StoryObj<typeof Logo> = {};

export const White: StoryObj<typeof Logo> = {
  args: { variant: "white" },
  parameters: {
    backgrounds: { default: "dark" }
  }
};
