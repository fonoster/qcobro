import { forwardRef } from "react";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils.js";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterBarProps {
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  filters?: { label: string; options: FilterOption[]; onChange?: (value: string) => void }[];
  className?: string;
}

export function FilterBar({ searchPlaceholder = "Search...", onSearch, filters = [], className }: FilterBarProps) {
  return (
    <div className={cn("flex items-center gap-4 border border-slate-200 bg-white p-4", className)}>
      <FilterSearchBox
        placeholder={searchPlaceholder}
        onChange={(e) => onSearch?.(e.target.value)}
      />
      {filters.map((filter, i) => (
        <FilterSelect key={i} onChange={(e) => filter.onChange?.(e.target.value)}>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </FilterSelect>
      ))}
    </div>
  );
}

const FilterSearchBox = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <div className={cn("relative flex-1 min-w-0", className)}>
      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        ref={ref}
        className="flex h-8 w-full bg-transparent pl-8 pr-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
        {...props}
      />
    </div>
  )
);
FilterSearchBox.displayName = "FilterSearchBox";

const FilterSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className={cn("relative shrink-0", className)}>
      <select
        ref={ref}
        className="flex h-10 w-[220px] appearance-none rounded-full border border-slate-200 bg-[#F8FAFC] px-4 py-2 pr-9 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-900 opacity-50" />
    </div>
  )
);
FilterSelect.displayName = "FilterSelect";
