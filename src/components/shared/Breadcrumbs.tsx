import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { absoluteUrl } from "@/lib/site";

export interface BreadcrumbItem {
  name: string;
  /** Absolute or root-relative path. Omit for the current page (last item). */
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Accessible breadcrumb trail that also emits a BreadcrumbList JSON-LD.
 * The last item is rendered as the current page (no link).
 */
export const Breadcrumbs = ({ items, className }: BreadcrumbsProps) => {
  if (!items.length) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <nav
        aria-label="Breadcrumb"
        className={
          className ??
          "abr-container pt-4 text-sm text-muted-foreground"
        }
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return (
              <li key={`${item.name}-${idx}`} className="flex items-center gap-1.5">
                {idx > 0 && (
                  <ChevronRight
                    className="h-3.5 w-3.5 text-muted-foreground/60"
                    aria-hidden
                  />
                )}
                {isLast || !item.href ? (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className="font-medium text-foreground line-clamp-1 max-w-[60vw]"
                  >
                    {item.name}
                  </span>
                ) : (
                  <Link
                    to={item.href}
                    className="transition hover:text-primary"
                  >
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
};

export default Breadcrumbs;
