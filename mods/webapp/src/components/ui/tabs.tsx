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
  onChange?: (id: string) => void;
  className?: string;
}

export function Tabs({ items, defaultTab, onChange, className }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);

  function select(id: string) {
    setActive(id);
    onChange?.(id);
  }

  const activeItem = items.find((t) => t.id === active);

  return (
    <div className={className}>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {items.map((tab) => (
          <button
            key={tab.id}
            onClick={() => select(tab.id)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeItem?.content && <div className="mt-4">{activeItem.content}</div>}
    </div>
  );
}
