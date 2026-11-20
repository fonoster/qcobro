import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Drawer } from "./drawer.js";
import { Button } from "./button.js";
import { Badge } from "./badge.js";
import { InputGroup } from "./input.js";
import { SelectGroup } from "./select.js";
import { Field } from "./field.js";
import { DayPicker } from "./day-picker.js";

const meta = {
  title: "UI/Drawer",
  component: Drawer,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"]
} satisfies Meta<typeof Drawer>;

export default meta;

/** A long create form: 560 wide, title 18/500 + subtitle, Cancelar + primary. */
export const CreateForm: StoryObj = {
  render: () => {
    const [open, setOpen] = useState(true);
    const [days, setDays] = useState([1, 2, 3, 4, 5]);
    return (
      <div className="p-6">
        <Button onClick={() => setOpen(true)}>Nueva campaña</Button>
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          width={560}
          title="Nueva campaña"
          subtitle="Define el programa, su agente y la ventana de ejecución."
          confirmLabel="Crear campaña"
          onSubmit={() => setOpen(false)}
        >
          <InputGroup label="Nombre de la campaña" placeholder="Recordatorio Vencidos Q2" />
          <SelectGroup label="Agente" defaultValue="">
            <option value="">Selecciona un agente</option>
            <option value="carla">Voz IA · Carla</option>
          </SelectGroup>
          <Field label="Días de operación">
            <DayPicker value={days} onChange={setDays} />
          </Field>
        </Drawer>
      </div>
    );
  }
};

/** Row details: badges under the title, an id at the footer's left. */
export const RecordDetail: StoryObj = {
  render: () => (
    <Drawer
      open
      onClose={() => {}}
      width={560}
      title="María González"
      subtitle="Cuenta LN-78452 · Voz IA · Hoy 14:32"
      headerExtra={
        <div className="mt-1 flex gap-2">
          <Badge>Entregado</Badge>
          <Badge>Promesa de pago</Badge>
        </div>
      }
      footerLeft={<span className="font-mono">ID de gestión 9f3c…</span>}
      footer={<Button variant="outline">Ver cuenta</Button>}
    >
      <p className="text-sm text-fg-muted">Contenido de la gestión.</p>
    </Drawer>
  )
};
