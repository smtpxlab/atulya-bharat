import { memo } from "react";
import { Link } from "react-router-dom";
import { Users, MapPin, ArrowRight } from "lucide-react";
import { stripHtml } from "@/lib/utils";
import type { Club } from "@/types/club";
import { usePrefetchOnHover } from "@/hooks/usePrefetchOnHover";
import { qk } from "@/lib/queryKeys";
import { getClubBySlug } from "@/services/club.service";

type Props = {
  club: Club;
};

const ClubCardLegacyComponent = ({ club }: Props) => {
  const clubTeaser = stripHtml(club.description ?? "").slice(0, 140);
  const prefetch = usePrefetchOnHover({
    queryKey: qk.clubs.bySlug(club.slug),
    queryFn: () => getClubBySlug(club.slug),
  });
  const initial = club.name?.[0]?.toUpperCase() ?? "C";
  const cover = club.banner_url ?? club.logo_url ?? null;
  const location = [club.promoter_city, club.promoter_state].filter(Boolean).join(", ");

  return (
    <Link
      to={`/clubs/${club.slug}`}
      {...prefetch}
      aria-label={`View ${club.name}`}
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={club.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
            <span className="font-display text-6xl font-bold text-primary/40">
              {initial}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 md:p-6">
        {location && (
          <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <MapPin className="h-3 w-3" /> {location}
          </p>
        )}

        <h3 className="mt-2 font-display text-xl text-navy leading-snug line-clamp-2">
          {club.name}
        </h3>

        {clubTeaser && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {clubTeaser}
          </p>
        )}

        <div className="mt-4 flex-1" />

        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80">
            <Users className="h-3.5 w-3.5" /> {club.member_count} members
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:gap-1.5 transition-all">
            View More <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
};

export const ClubCardLegacy = memo(ClubCardLegacyComponent);
