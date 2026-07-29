import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { stripHtml } from "@/lib/utils";
import { usePrefetchOnHover } from "@/hooks/usePrefetchOnHover";
import { qk } from "@/lib/queryKeys";
import { getChallengeDetails } from "@/services/challenge.service";
import type { ChallengeCardData } from "./ChallengeCard";

export const ChallengeCardLegacy = ({ c }: { c: ChallengeCardData }) => {
  const teaser = stripHtml(c.description ?? "");
  const prefetch = usePrefetchOnHover({
    queryKey: qk.challenges.detail(c.slug),
    queryFn: () => getChallengeDetails(c.slug),
  });

  return (
    <Link
      to={`/challenges/${c.slug}`}
      {...prefetch}
      aria-label={`View ${c.name}`}
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {c.cover_image_url ? (
          <img
            src={c.cover_image_url}
            alt={c.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grad-warm absolute inset-0" />
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 md:p-6">
        {c.city && (
          <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <MapPin className="h-3 w-3" /> {c.city}
          </p>
        )}

        <h3 className="mt-2 font-display text-xl text-navy leading-snug line-clamp-2">
          {c.name}
        </h3>

        {teaser && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {teaser}
          </p>
        )}

        <div className="mt-4 flex-1" />

        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
            <span>{c.distance} KM</span>
            {c.min_price != null && (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-foreground/90">
                ₹{c.min_price}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:gap-1.5 transition-all">
            View More <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
};
