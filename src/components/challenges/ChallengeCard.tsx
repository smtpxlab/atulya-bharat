import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { stripHtml } from "@/lib/utils";
import { usePrefetchOnHover } from "@/hooks/usePrefetchOnHover";
import { qk } from "@/lib/queryKeys";
import { getChallengeDetails } from "@/services/challenge.service";

export type ChallengeCardData = {
  id: string;
  slug: string;
  name: string;
  challenge_type: string;
  distance: number;
  start_at?: string | null;
  tags?: string[];
  cover_image_url: string | null;
  description?: string | null;
  min_price?: number | null;
  city?: string | null;
};

export const ChallengeCard = ({ c }: { c: ChallengeCardData }) => {
  const teaser = stripHtml(c.description ?? "");
  const prefetch = usePrefetchOnHover({
    queryKey: qk.challenges.detail(c.slug),
    queryFn: () => getChallengeDetails(c.slug),
  });

  return (
    <article className="group heritage-card flex flex-col">
      <Link
        to={`/challenges/${c.slug}`}
        {...prefetch}
        className="relative block h-56 overflow-hidden bg-muted"
        aria-label={`View ${c.name}`}
      >
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
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl font-bold text-accent leading-tight">
            {c.name}
          </h3>
          {c.min_price != null && (
            <span className="shrink-0 font-display text-base font-bold text-success">
              ₹{c.min_price}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {c.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {c.city}
            </span>
          )}
          <span>{c.distance} KM</span>
        </div>

        {teaser && (
          <p className="mt-3 line-clamp-2 text-sm text-foreground/75">
            {teaser}
          </p>
        )}

        <div className="mt-5 pt-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary"
              style={{ width: "42%" }}
              aria-hidden
            />
          </div>
        </div>

        <div className="mt-6 pt-1">
          <Link
            to={`/challenges/${c.slug}`}
            {...prefetch}
            className="btn-outline-navy block w-full text-center"
          >
            View Challenge
          </Link>
        </div>
      </div>
    </article>
  );
};
