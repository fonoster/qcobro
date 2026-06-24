import type { Preview } from "@storybook/react";
import { I18nProvider } from "../src/lib/i18n.js";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    backgrounds: { default: "light" },
    layout: "centered"
  },
  decorators: [
    (Story) => (
      <I18nProvider>
        <Story />
      </I18nProvider>
    )
  ]
};

export default preview;
