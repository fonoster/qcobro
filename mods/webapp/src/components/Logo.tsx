import { cn } from "@/lib/utils.js";

export function Logo({
  className,
  variant = "default"
}: {
  className?: string;
  variant?: "default" | "white";
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          variant === "white" ? "bg-white/20" : "bg-emerald-700"
        )}
      >
        <span className="text-[17px] font-extrabold text-white">Q</span>
      </div>
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[18px] font-extrabold",
            variant === "white" ? "text-white" : "text-slate-900"
          )}
          style={{ letterSpacing: "-0.3px" }}
        >
          QCobro
        </span>
        <span
          className={cn(
            "text-[10px] font-medium",
            variant === "white" ? "text-emerald-200" : "text-slate-500"
          )}
          style={{ letterSpacing: "0.4px" }}
        >
          by Fonoster
        </span>
      </div>
    </div>
  );
}
