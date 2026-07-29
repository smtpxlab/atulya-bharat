import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useClubs } from "@/features/clubs/hooks/useClubs";
import { ClubCardLegacy } from "@/components/clubs/ClubCardLegacy";
import { ClubCardSkeleton } from "@/components/clubs/ClubCardSkeleton";
import { EmptyState } from "@/components/clubs/EmptyState";
import { Button } from "@/components/ui/button";
import { Compass, Plus } from "lucide-react";
import { SEO } from "@/components/SEO";

const Clubs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: clubs = [], isLoading } = useClubs();

  // Featured first, then newest
  const ordered = useMemo(() => {
    return [...clubs].sort(
      (a, b) =>
        b.priority - a.priority ||
        +new Date(b.created_at) - +new Date(a.created_at),
    );
  }, [clubs]);

  return (
    <main>
      <SEO
        title="Running & Fitness Clubs in India | Atulya Bharat Run"
        description="Discover and join fitness clubs across India — running, cycling, yoga and more. Connect with your local community on Atulya Bharat Run."
        path="/clubs"
        keywords={[
          "running clubs India",
          "fitness clubs India",
          "cycling clubs",
          "join running club",
          "Atulya Bharat Run",
        ]}
      />
      <section className="abr-container pt-12 pb-8 md:pt-16">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Community
            </p>
            <h1 className="mt-3 font-display text-navy">Explore Clubs</h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              Find your fitness community — clubs hosted by runners, riders and
              wellness leaders from across India.
            </p>
          </div>
          <Button
            onClick={() => navigate(user ? "/clubs/create" : "/login?redirect=/clubs/create")}
            size="lg"
            className="rounded-full"
          >
            <Plus className="mr-2 h-4 w-4" /> Create Club
          </Button>
        </div>
      </section>

      <section className="abr-container pb-20">
        <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <ClubCardSkeleton key={i} />)
          ) : ordered.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                icon={<Compass className="h-7 w-7" />}
                title="No clubs available yet"
                description="New clubs are being onboarded. Check back soon."
              />
            </div>
          ) : (
            ordered.map((c) => <ClubCardLegacy key={c.id} club={c} />)
          )}
        </div>
      </section>
    </main>
  );
};


export default Clubs;
