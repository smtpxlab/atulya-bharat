import { memo } from "react";
import { Link } from "react-router-dom";
import { Users, MapPin } from "lucide-react";
import { stripHtml } from "@/lib/utils";
import type { Club } from "@/types/club";
import { usePrefetchOnHover } from "@/hooks/usePrefetchOnHover";
import { qk } from "@/lib/queryKeys";
import { getClubBySlug } from "@/services/club.service";

type Props = {
  club: Club;
  isMember?: boolean;
  onJoin?: (clubId: string) => void;
  joinPending?: boolean;
  accent?: "saffron" | "gold" | "navy";
};

const accentMap = {
  saffron: { bar: "bg-primary", mono: "bg-primary text-primary-foreground" },
  gold: { bar: "bg-gold", mono: "bg-gold text-gold-foreground" },
  navy: { bar: "bg-accent", mono: "bg-accent text-accent-foreground" },
} as const;

const ClubCardComponent = ({ club, isMember, accent = "saffron" }: Props) => {
  const clubTeaser = stripHtml(club.description).slice(0, 110);
  const prefetch = usePrefetchOnHover({
    queryKey: qk.clubs.bySlug(club.slug),
    queryFn: () => getClubBySlug(club.slug),
  });
  const ax = accentMap[accent];
  const initial = club.name?.[0]?.toUpperCase() ?? "C";

  return (
    <article className="group heritage-card flex h-full flex-col">
      {/* Top accent bar */}
      <div className={`h-1 w-full ${ax.bar}`} aria-hidden />

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full font-display text-xl font-bold ${ax.mono}`}
            aria-hidden
          >
            {initial}
          </div>
          <div className="min-w-0">
            <Link
              to={`/clubs/${club.slug}`}
              {...prefetch}
              className="font-display text-lg font-bold text-accent leading-tight outline-none hover:text-primary transition-colors"
            >
              <span className="line-clamp-1">{club.name}</span>
            </Link>
            {(club.promoter_city || club.promoter_state) && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {[club.promoter_city, club.promoter_state]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          </div>
        </div>

        {clubTeaser && (
          <p className="mt-4 line-clamp-2 text-sm text-foreground/75">
            {clubTeaser}
          </p>
        )}

        <div className="mt-5 flex items-center gap-5 text-xs text-muted-foreground">
          <div>
            <p className="font-display text-lg font-bold text-accent leading-none">
              {club.member_count}
            </p>
            <p className="mt-1 inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> Members
            </p>
          </div>
        </div>

        <div className="mt-auto pt-6">
          <Link
            to={`/clubs/${club.slug}`}
            {...prefetch}
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary hover:text-accent transition-colors"
          >
            {isMember ? "View Club →" : "Join Club →"}
          </Link>
        </div>
      </div>
    </article>
  );
};

export const ClubCard = memo(ClubCardComponent);
