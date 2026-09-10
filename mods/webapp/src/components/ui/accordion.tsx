import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils.js";

export interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  defaultOpen?: string;
  className?: string;
}

export function Accordion({ items, defaultOpen, className }: AccordionProps) {
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null);
  return (
    <div className={cn("divide-y divide-border rounded-xl border border-border", className)}>
      {items.map((item) => {
        const isOpen = open === item.id;
        return (
          <div key={item.id}>
            <button
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-fg hover:bg-elevated"
              onClick={() => setOpen(isOpen ? null : item.id)}
              aria-expanded={isOpen}
            >
              {item.title}
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-fg-subtle transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            {isOpen && <div className="px-4 pb-4 text-sm text-fg-muted">{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
