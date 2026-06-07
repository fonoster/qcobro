import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card.js";
import { Button } from "./button.js";
import { Badge } from "./badge.js";

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Card>;

export default meta;

export const Simple: StoryObj = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Cartera Bancolombia</CardTitle>
        <CardDescription>Portafolio de crédito vencido</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">Saldo total: $1,240,000</p>
      </CardContent>
    </Card>
  )
};

export const WithFooter: StoryObj = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Campaña Q2 2024</CardTitle>
        <CardDescription>Cobranza preventiva</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">Progreso: 68% completado</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Ver detalles</Button>
        <Button size="sm" variant="outline">
          Pausar
        </Button>
      </CardFooter>
    </Card>
  )
};

export const WithBadge: StoryObj = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Agente: María López</CardTitle>
          <Badge variant="success">Activo</Badge>
        </div>
        <CardDescription>Cobrador senior</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">Gestiones hoy: 24 / 30</p>
      </CardContent>
    </Card>
  )
};
