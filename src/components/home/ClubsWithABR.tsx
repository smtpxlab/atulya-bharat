import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useClubs } from "@/features/clubs/hooks/useClubs";
import { ClubCard } from "@/components/clubs/ClubCard";
import { SectionHeading } from "@/components/shared/SectionHeading";

const accents = ["saffron", "gold", "navy", "saffron"] as const;

export const ClubsWithABR = () => {
  const { data, isLoading } = useClubs();
  const items = (data ?? []).slice(0, 4);

  if (!isLoading && items.length === 0) return null;

  return (
    <section
      aria-labelledby="clubs-title"
      className="abr-container py-20"
    >
      <SectionHeading
        eyebrow="Community"
        title={
          <>
            Run Clubs <span className="italic text-gold">Across India</span>
          </>
        }
        subtitle="Train with a tribe that keeps you going. Find your captains, pacers, and weekend trail."
        linkLabel="Explore all clubs"
        linkTo="/clubs"
      />

      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? [0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[260px] rounded-none" />
            ))
          : items.map((club, idx) => (
              <ClubCard
                key={club.id}
                club={club}
                accent={accents[idx % accents.length]}
              />
            ))}
      </div>

      {/* Dashed CTA strip */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border border-dashed border-primary/40 bg-primary/5 p-6">
        <div>
          <p className="font-display text-xl text-accent">
            Don't see your city?
          </p>
          <p className="text-sm text-muted-foreground">
            Start a club and bring your community along for the season.
          </p>
        </div>
        <Link to="/clubs" className="btn-saffron h-auto">
          Create a Club
        </Link>
      </div>
    </section>
  );
};

export default ClubsWithABR;
