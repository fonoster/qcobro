import type { Preview } from "@storybook/react";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    backgrounds: { default: "light" },
    layout: "centered"
  }
};

export default preview;
