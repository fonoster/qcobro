import type { Meta, StoryObj } from "@storybook/react";
import { Accordion } from "./accordion.js";

const meta = {
  title: "UI/Accordion",
  component: Accordion,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Accordion>;

export default meta;

const items = [
  {
    id: "1",
    title: "¿Cómo funciona la cobranza preventiva?",
    content: "La cobranza preventiva contacta al deudor antes del vencimiento para recordarle su obligación y evitar mora."
  },
  {
    id: "2",
    title: "¿Qué canales se usan para contactar?",
    content: "Utilizamos llamadas telefónicas, SMS, WhatsApp y correo electrónico según la estrategia configurada."
  },
  {
    id: "3",
    title: "¿Cómo se registra una promesa de pago?",
    content: "El agente registra la promesa en el sistema indicando monto, fecha comprometida y canal de contacto."
  }
];

export const Default: StoryObj = {
  render: () => <Accordion items={items} className="w-[480px]" />
};

export const WithDefaultOpen: StoryObj = {
  render: () => <Accordion items={items} defaultOpen="2" className="w-[480px]" />
};
