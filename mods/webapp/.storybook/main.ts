import type { StorybookConfig } from "@storybook/react-vite";
import path from "path";

const root = process.cwd();

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials"],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
  typescript: {
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      tsConfigPath: path.join(root, "tsconfig.app.json")
    }
  },
  viteFinal: async (config) => {
    const { mergeConfig } = await import("vite");
    return mergeConfig(config, {
      resolve: {
        alias: { "@": path.join(root, "src") }
      }
    });
  }
};

export default config;
