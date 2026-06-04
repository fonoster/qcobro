import type { Meta, StoryObj } from "@storybook/react";
import { FilterBar } from "./filter-bar.js";

const meta = {
  title: "Components/FilterBar",
  component: FilterBar,
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta<typeof FilterBar>;

export default meta;

export const SearchOnly: StoryObj = {
  render: () => <FilterBar searchPlaceholder="Buscar deudor..." />
};

export const WithFilters: StoryObj = {
  render: () => (
    <FilterBar
      searchPlaceholder="Buscar por nombre o documento..."
      filters={[
        {
          label: "Estado",
          options: [
            { value: "", label: "Todos los estados" },
            { value: "al_dia", label: "Al día" },
            { value: "mora", label: "En mora" },
            { value: "critico", label: "Crítico" }
          ]
        },
        {
          label: "Canal",
          options: [
            { value: "", label: "Todos los canales" },
            { value: "llamada", label: "Llamada" },
            { value: "sms", label: "SMS" },
            { value: "whatsapp", label: "WhatsApp" }
          ]
        }
      ]}
    />
  )
};
