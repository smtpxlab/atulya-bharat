import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveSection } from "@/hooks/useActiveSection";

export type SectionNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type Props = {
  items: SectionNavItem[];
  /** prefix applied to ids in the DOM, default `section-` */
  idPrefix?: string;
};

const scrollTo = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top: y, behavior: "smooth" });
};

export const SectionNav = ({ items, idPrefix = "section-" }: Props) => {
  const ids = items.map((i) => `${idPrefix}${i.id}`);
  const active = useActiveSection(ids);

  return (
    <>
      {/* Desktop: sticky icon-card column */}
      <nav
        aria-label="Page sections"
        className="hidden lg:sticky lg:top-24 lg:block lg:self-start"
      >
        <ul className="space-y-2">
          {items.map((it) => {
            const fullId = `${idPrefix}${it.id}`;
            const isActive = active === fullId;
            const Icon = it.icon;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => scrollTo(fullId)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm font-medium transition-all",
                    isActive
                      ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{it.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile / tablet: horizontal scroll tabs */}
      <nav
        aria-label="Page sections"
        className="sticky top-[64px] z-30 -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-border bg-background px-4 py-2 shadow-sm lg:hidden"
      >
        {items.map((it) => {
          const fullId = `${idPrefix}${it.id}`;
          const isActive = active === fullId;
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => scrollTo(fullId)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-muted/70",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {it.label}
            </button>
          );
        })}
      </nav>
    </>
  );
};
