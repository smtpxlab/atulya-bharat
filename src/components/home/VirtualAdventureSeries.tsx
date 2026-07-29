import { Skeleton } from "@/components/ui/skeleton";
import { useChallenges } from "@/features/challenges/hooks/useChallenges";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { SectionHeading } from "@/components/shared/SectionHeading";

export const VirtualAdventureSeries = () => {
  const { data, isLoading } = useChallenges();
  const items = (data ?? []).slice(0, 3);

  if (!isLoading && items.length === 0) return null;

  return (
    <section
      id="featured-challenges"
      aria-labelledby="featured-title"
      className="abr-container py-20"
    >
      <SectionHeading
        eyebrow="2026 Season · Featured"
        title={
          <>
            Featured <span className="italic text-gold">Challenges</span>
          </>
        }
        subtitle="Iconic Indian routes mapped to real distances. Pick a city, lock in the medal."
        linkLabel="View all challenges"
        linkTo="/challenges"
      />

      <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? [0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[440px] rounded-none" />
            ))
          : items.map((c) => (
              <ChallengeCard
                key={c.id}
                c={{
                  id: c.id,
                  slug: c.slug,
                  name: c.name,
                  challenge_type: c.challenge_type,
                  distance: c.distance,
                  start_at: c.start_at,
                  tags: c.tags ?? [],
                  cover_image_url: c.cover_image_url,
                  description: (c as { description?: string }).description ?? null,
                  min_price: (c as { min_price?: number | null }).min_price ?? null,
                  city: (c as { city?: string | null }).city ?? null,
                }}
              />
            ))}
      </div>
    </section>
  );
};

export default VirtualAdventureSeries;
