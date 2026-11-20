import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "./Logo.js";
import { cn } from "@/lib/utils.js";

/**
 * The shared frame of the sign-in pages (sign-in, sign-up, verification, password reset and
 * invitations): the logo above one centered card with a border, and an optional `footer`
 * under the card (a "¿Ya tienes cuenta?" line, a back link). In the dark theme the page shows
 * Fonoster's pattern (white dots, so the light theme keeps the plain ground).
 */
export function AuthLayout({
  children,
  footer,
  className
}: {
  children: ReactNode;
  /** Content under the card, outside it. */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg bg-cover bg-center px-4 py-10 dark:bg-[url(/pattern-center.png)]">
      <div className="flex w-full max-w-[444px] flex-col items-center gap-7">
        <Logo />
        <main
          data-auth-card
          className={cn(
            "flex w-full flex-col gap-7 rounded-m border border-border bg-sunken p-8",
            className
          )}
        >
          {children}
        </main>
        {footer}
      </div>
    </div>
  );
}

/** The card's centered title and optional subtitle. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <h1 className="text-[26px] font-semibold leading-tight text-fg">{title}</h1>
      {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
    </div>
  );
}

/** The "o" rule between the form and the Google button. */
export function AuthOrDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-fg-muted">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** A centered line under or inside the card: muted text, then a 500-weight link. */
export function AuthFooterLine({ text, to, link }: { text: string; to: string; link: string }) {
  return (
    <p className="text-center text-[13px] text-fg-muted">
      {text}{" "}
      <Link to={to} className="font-medium text-fg underline-offset-2 hover:underline">
        {link}
      </Link>
    </p>
  );
}

/** The muted "← Volver a iniciar sesión" link under the card, with a lucide arrow. */
export function AuthBackLink({ to = "/login", children }: { to?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 text-[13px] text-fg-muted underline-offset-2 hover:text-fg hover:underline"
    >
      <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}
