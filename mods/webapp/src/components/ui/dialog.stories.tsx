import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Dialog } from "./dialog.js";
import { Button } from "./button.js";
import { InputGroup } from "./input.js";

const meta = {
  title: "UI/Dialog",
  component: Dialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Dialog>;

export default meta;

/** A short create: header band with subtitle, fields, Cancelar + primary on the right. */
export const ShortCreate: StoryObj = {
  render: () => {
    const [open, setOpen] = useState(true);
    const [name, setName] = useState("");
    const [error, setError] = useState<string>();
    return (
      <>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva cartera
        </Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Nueva cartera"
          subtitle="Una cartera agrupa las cuentas de un cliente."
          confirmLabel="Crear cartera"
          onSubmit={() => (name ? setOpen(false) : setError("El nombre es requerido."))}
        >
          <InputGroup
            label="Nombre de la cartera"
            placeholder="Bancolombia Q3 2026"
            value={name}
            error={error}
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
          />
          <InputGroup label="ID del cliente" placeholder="bancolombia" className="font-mono" />
        </Dialog>
      </>
    );
  }
};

/** A confirmation: 480 wide, no body, destructive primary. */
export const Confirm: StoryObj = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Quitar miembro
        </Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          width={480}
          title="¿Quitar a Carmen Ruiz?"
          subtitle="Perderá el acceso a este espacio de inmediato."
          confirmVariant="destructive"
          confirmLabel="Quitar"
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  }
};

/** No confirm action: the footer is a single "Cerrar". */
export const Informational: StoryObj = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Gestionar plan
        </Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Gestionar plan" width={560}>
          <p className="text-sm text-fg-muted">Contenido informativo.</p>
        </Dialog>
      </>
    );
  }
};

/** A submission error from the server, above the footer. */
export const WithError: StoryObj = {
  render: () => (
    <Dialog
      open
      onClose={() => {}}
      title="Agregar número"
      confirmLabel="Agregar número"
      onConfirm={() => {}}
      error="No se pudo agregar el número."
    >
      <InputGroup label="Etiqueta" placeholder="Cobranza suave" />
    </Dialog>
  )
};
