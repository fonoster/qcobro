import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./ui/button.js";
import { Card } from "./ui/card.js";
import { Badge } from "./ui/badge.js";
import { InputGroup } from "./ui/input.js";

const meta: Meta = {
  title: "Brand/Appearance",
  parameters: { layout: "fullscreen" }
};
export default meta;

const TOKENS: [string, string][] = [
  ["bg-bg", "page ground"],
  ["bg-surface", "card / sidebar"],
  ["bg-elevated", "raised / hover"],
  ["bg-primary", "primary action"],
  ["bg-brand-green", "brand accent"],
  ["bg-success-soft", "success tint"],
  ["bg-warning-soft", "warning tint"],
  ["bg-danger-soft", "danger tint"]
];

const TEXT: [string, string][] = [
  ["text-fg", "primary text"],
  ["text-fg-muted", "secondary text"],
  ["text-fg-subtle", "tertiary text"],
  ["text-primary", "accent text"],
  ["text-danger", "danger text"],
  ["text-warning", "warning text"]
];

export const Palette: StoryObj = {
  render: () => (
    <div className="min-h-screen bg-bg p-8 text-fg">
      <h2 className="mb-1 text-lg font-bold">Appearance tokens</h2>
      <p className="mb-6 text-sm text-fg-subtle">
        Flip the Theme control in the toolbar to check light and dark.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TOKENS.map(([cls, label]) => (
          <div key={cls} className="overflow-hidden rounded-lg border border-border">
            <div className={`h-16 ${cls}`} />
            <div className="bg-surface px-3 py-2">
              <div className="font-mono text-xs text-fg">{cls}</div>
              <div className="text-xs text-fg-subtle">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap gap-4 rounded-lg border border-border bg-surface p-4">
        {TEXT.map(([cls, label]) => (
          <div key={cls} className={`text-sm font-medium ${cls}`}>
            {label}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
        </div>
        <Card className="max-w-sm p-4">
          <p className="text-sm font-semibold text-fg">Card surface</p>
          <p className="mt-1 text-sm text-fg-muted">
            Sits on the page ground with a subtle border.
          </p>
        </Card>
        <div className="max-w-sm">
          <InputGroup id="theme-demo" label="Field" placeholder="e.g. Cartera Abril" />
        </div>
      </div>
    </div>
  )
};
