import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Dialog } from "./dialog.js";
import { Button } from "./button.js";
import { AlertTriangle, Trash2 } from "lucide-react";

const meta = {
  title: "UI/Dialog",
  component: Dialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Dialog>;

export default meta;

export const Default: StoryObj = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Abrir diálogo</Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Confirmar acción"
          description="¿Estás seguro de que deseas continuar? Esta acción no se puede deshacer."
          confirmLabel="Confirmar"
          cancelLabel="Cancelar"
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  }
};

export const Centered: StoryObj = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Diálogo centrado</Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          align="center"
          icon={<AlertTriangle className="h-10 w-10 text-amber-500" />}
          title="¿Pausar campaña?"
          description="La campaña se pausará y los agentes no recibirán nuevas asignaciones."
          confirmLabel="Pausar"
          cancelLabel="Volver"
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  }
};

export const Destructive: StoryObj = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="destructive" onClick={() => setOpen(true)}>Eliminar</Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          align="center"
          icon={<Trash2 className="h-10 w-10 text-red-500" />}
          title="Eliminar cartera"
          description="Esta acción eliminará permanentemente la cartera y todos sus datos asociados."
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  }
};
