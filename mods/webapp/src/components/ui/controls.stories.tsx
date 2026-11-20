import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { AudioLines, Bot, Folder, Mail, MessageCircle, MessageSquare, Plus } from "lucide-react";
import { SegmentedControl } from "./segmented.js";
import { FilterChip } from "./filter-chip.js";
import { ChoiceCardGroup } from "./choice-cards.js";
import { DayPicker } from "./day-picker.js";
import { EmptyState } from "./empty-state.js";
import { Tabs } from "./tabs.js";
import { Pagination } from "./pagination.js";
import { Button } from "./button.js";
import { Field } from "./field.js";

const meta = {
  title: "UI/Controls",
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta;

export default meta;

export const Segmented: StoryObj = {
  render: () => {
    const [v, setV] = useState("7d");
    return (
      <SegmentedControl
        aria-label="Periodo"
        value={v}
        onChange={setV}
        options={[
          { value: "today", label: "Hoy" },
          { value: "7d", label: "7 d" },
          { value: "month", label: "Este mes" },
          { value: "custom", label: "Personalizado" }
        ]}
      />
    );
  }
};

export const FilterChips: StoryObj = {
  render: () => {
    const [canal, setCanal] = useState("");
    const [entrega, setEntrega] = useState("DELIVERED");
    return (
      <div className="flex gap-3">
        <FilterChip
          label="Canal"
          value={canal}
          onChange={setCanal}
          options={[
            { value: "", label: "Todos" },
            { value: "VOICE_AI", label: "Voz IA" },
            { value: "SMS", label: "SMS" }
          ]}
        />
        <FilterChip
          label="Entrega"
          value={entrega}
          onChange={setEntrega}
          options={[
            { value: "", label: "Todas" },
            { value: "DELIVERED", label: "Entregado" }
          ]}
        />
      </div>
    );
  }
};

export const ChoiceCards: StoryObj = {
  render: () => {
    const [v, setV] = useState("VOICE_AI");
    return (
      <div className="w-[472px]">
        <ChoiceCardGroup
          vertical
          value={v}
          onChange={setV}
          options={[
            {
              value: "VOICE_AI",
              title: "Voz IA",
              description: "Conversa por teléfono y registra promesas de pago.",
              icon: <Bot />
            },
            {
              value: "VOICE_PRERECORDED",
              title: "Voz pregrabada",
              description: "Reproduce un mensaje grabado, con menú de teclas.",
              icon: <AudioLines />
            },
            {
              value: "SMS",
              title: "SMS",
              description: "Envía un mensaje de texto con tus variables.",
              icon: <MessageSquare />
            },
            {
              value: "WHATSAPP",
              title: "WhatsApp",
              description: "Envía una plantilla aprobada y responde con IA.",
              icon: <MessageCircle />
            },
            {
              value: "EMAIL",
              title: "Correo",
              description: "Envía un correo y responde con IA.",
              icon: <Mail />
            }
          ]}
        />
      </div>
    );
  }
};

export const Days: StoryObj = {
  render: () => {
    const [days, setDays] = useState([1, 2, 3, 4, 5]);
    return (
      <Field label="Días de operación">
        <DayPicker value={days} onChange={setDays} />
      </Field>
    );
  }
};

export const Empty: StoryObj = {
  render: () => (
    <EmptyState
      icon={<Folder />}
      title="Todavía no tienes carteras"
      body="Crea una cartera por cliente y sincroniza sus cuentas desde un CSV."
      action={
        <Button>
          <Plus className="h-4 w-4" />
          Nueva cartera
        </Button>
      }
    />
  )
};

export const UnderlinedTabs: StoryObj = {
  render: () => (
    <Tabs
      items={[
        { id: "config", label: "Configuración", content: <p className="text-sm">Configuración</p> },
        { id: "preview", label: "Vista previa", content: <p className="text-sm">Vista previa</p> }
      ]}
    />
  )
};

export const Pager: StoryObj = {
  render: () => {
    const [page, setPage] = useState(1);
    return <Pagination page={page} totalPages={3} onPageChange={setPage} />;
  }
};
