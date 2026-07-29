import { ChallengeCardLegacy } from "@/components/challenges/ChallengeCardLegacy";
import { Skeleton } from "@/components/ui/skeleton";
import { useChallenges } from "@/features/challenges/hooks/useChallenges";
import type { ChallengeListItem } from "@/types/challenge";
import { SEO } from "@/components/SEO";

const Challenges = () => {
  const { data, isLoading } = useChallenges();
  const challenges: ChallengeListItem[] = data ?? [];

  return (
    <main>
      <SEO
        title="Virtual Running & Cycling Challenges India | Atulya Bharat Run"
        description="Browse virtual running, walking & cycling challenges across India. Complete distance goals and unlock heritage milestones from iconic Indian cities."
        path="/challenges"
        keywords={[
          "virtual running challenges India",
          "virtual cycling challenges",
          "heritage running events",
          "fitness challenges India",
          "Atulya Bharat Run",
        ]}
      />
      {/* Hero */}
      <section className="abr-container pt-12 pb-8 md:pt-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Virtual Adventure Series
          </p>
          <h1 className="mt-3 font-display text-navy">
            Explore Virtual Challenges
          </h1>
          <p className="mt-3 font-display text-xl text-navy/80 md:text-2xl">
            Run. Walk. Ride. Discover India.
          </p>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            Complete fitness challenges while virtually exploring India's most
            iconic destinations.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="abr-container pb-20">
        {isLoading ? (
          <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
              >
                <Skeleton className="aspect-[16/10] w-full rounded-none" />
                <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : challenges.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-12 text-center">
            <p className="font-display text-xl text-navy">
              No challenges available right now
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back soon — new adventures are on the way.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {challenges.map((c) => (
              <ChallengeCardLegacy key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default Challenges;
