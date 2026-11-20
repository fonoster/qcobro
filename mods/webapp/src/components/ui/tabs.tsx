import { useState } from "react";
import { cn } from "@/lib/utils.js";

export interface TabItem {
  id: string;
  label: string;
  content?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultTab?: string;
  /** Controlled active tab. */
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
}

/**
 * Underlined tabs: a bottom border across the row, the active tab in the foreground with a
 * 2 px foreground underline, the rest muted. Gap 24.
 *
 * @example <Tabs items={[{ id: "config", label: "Configuración", content: … }]} />
 */
export function Tabs({ items, defaultTab, value, onChange, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultTab ?? items[0]?.id);
  const active = value ?? internal;

  function select(id: string) {
    setInternal(id);
    onChange?.(id);
  }

  const activeItem = items.find((t) => t.id === active);

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-6 border-b border-border">
        {items.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => select(tab.id)}
              className={cn(
                "-mb-px cursor-pointer border-b-2 py-2.5 text-[13px] transition-colors",
                isActive
                  ? "border-fg font-medium text-fg"
                  : "border-transparent text-fg-muted hover:text-fg"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeItem?.content && <div className="mt-5">{activeItem.content}</div>}
    </div>
  );
}
