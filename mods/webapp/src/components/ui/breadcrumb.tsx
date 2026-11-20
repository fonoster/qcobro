import { Fragment } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils.js";

export interface BreadcrumbItem {
  label: string;
  /** Route for a parent crumb; the last crumb is the current page and takes none. */
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * "Agentes IA / Carla": muted parent links separated by "/", the current page in the
 * foreground. Replaces "← Volver a …" buttons on detail pages.
 *
 * @example <Breadcrumb items={[{ label: t("nav.agents"), href: "/agents" }, { label: name }]} />
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" className={cn("flex items-center gap-1.5 text-[13px]", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && (
              <span aria-hidden className="text-fg-muted">
                /
              </span>
            )}
            {isLast ? (
              <span aria-current="page" className="truncate text-fg">
                {item.label}
              </span>
            ) : item.href ? (
              <Link to={item.href} className="text-fg-muted hover:text-fg">
                {item.label}
              </Link>
            ) : (
              <span className="text-fg-muted">{item.label}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
