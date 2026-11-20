import { useEffect } from "react";
import type { Preview } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../src/lib/i18n.js";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "@fontsource/roboto-mono/600.css";
import "../src/index.css";

type ThemeGlobal = "system" | "light" | "dark";

function resolve(theme: ThemeGlobal): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const preview: Preview = {
  parameters: {
    layout: "centered"
  },
  globalTypes: {
    theme: {
      description: "Console appearance",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "contrast",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "system", title: "System" }
        ],
        dynamicTitle: true
      }
    }
  },
  decorators: [
    (Story, context) => {
      const resolved = resolve(context.globals.theme as ThemeGlobal);
      useEffect(() => {
        document.documentElement.dataset.theme = resolved;
      }, [resolved]);
      return (
        <MemoryRouter>
          <I18nProvider>
            <div className="bg-bg text-fg" style={{ padding: "1.5rem", minWidth: "20rem" }}>
              <Story />
            </div>
          </I18nProvider>
        </MemoryRouter>
      );
    }
  ]
};

export default preview;
