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

// `variant="white"` forces the light treatment for always-dark surfaces (auth brand panel).
export const OnDarkSurface: StoryObj<typeof Logo> = {
  args: { variant: "white" },
  render: (args) => (
    <div style={{ background: "#141417", padding: "2rem", borderRadius: 12 }}>
      <Logo {...args} />
    </div>
  )
};
