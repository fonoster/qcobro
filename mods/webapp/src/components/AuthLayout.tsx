import type { ReactNode } from "react";
import { Logo } from "./Logo.js";
import { cn } from "@/lib/utils.js";

/**
 * The shared frame of the sign-in pages (sign-in, sign-up, verification, password reset and
 * invitations): the logo above one centered card. In the dark theme the page shows Fonoster's
 * pattern (white dots, so the light theme keeps the plain ground).
 */
export function AuthLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg bg-cover bg-center px-4 py-10 dark:bg-[url(/pattern-center.png)]">
      <div className="flex w-full max-w-[444px] flex-col items-center gap-8">
        <Logo />
        <main
          data-auth-card
          className={cn("flex w-full flex-col gap-6 rounded-m bg-sunken p-8", className)}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/** The card's centered title and optional subtitle. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <h1 className="text-[26px] font-semibold leading-tight text-fg">{title}</h1>
      {subtitle && <p className="text-sm text-fg-subtle">{subtitle}</p>}
    </div>
  );
}
