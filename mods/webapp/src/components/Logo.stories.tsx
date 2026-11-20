import type { Meta, StoryObj } from "@storybook/react";
import { Logo } from "./Logo.js";

const meta: Meta<typeof Logo> = {
  title: "Brand/Logo",
  component: Logo
};

export default meta;

// Default follows the theme (dark ink in light, near-white in dark) — flip the Theme
// toolbar to check both.
export const Default: StoryObj<typeof Logo> = {};
