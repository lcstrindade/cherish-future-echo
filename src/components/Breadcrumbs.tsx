import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

type Crumb = { label: string; to?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground mb-6"
    >
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {c.to && !isLast ? (
              <Link
                to={c.to}
                className="hover:text-foreground transition-colors"
              >
                {c.label}
              </Link>
            ) : (
              <span className={isLast ? "text-foreground font-medium" : ""}>
                {c.label}
              </span>
            )}
            {!isLast && <ChevronRight className="h-3 w-3 opacity-50" />}
          </span>
        );
      })}
    </nav>
  );
}