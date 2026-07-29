import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Compass, Plus } from "lucide-react";

type Props = { onCreate: () => void };

export const ClubsHero = ({ onCreate }: Props) => (
  <section className="relative isolate overflow-hidden">
    <div className="absolute inset-0 -z-10">
      <img
        src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1920&q=70"
        alt=""
        aria-hidden
        className="h-full w-full object-cover"
        fetchPriority="high"
      />
      <div className="absolute inset-0 grad-overlay" />
    </div>

    <div className="abr-container py-16 md:py-24 lg:py-28">
      <div className="max-w-2xl text-navy-foreground animate-slide-up">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-md ring-1 ring-white/25">
          <Compass className="h-3.5 w-3.5" /> Community
        </span>
        <h1 className="mt-4 font-display text-display-1 text-white">
          Find Your Fitness Community
        </h1>
        <p className="mt-4 text-base text-white/85 md:text-lg">
          Join clubs, connect with like-minded people, and unlock exclusive
          benefits across India.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-full">
            <a href="#explore">
              <Compass className="mr-2 h-4 w-4" /> Explore Clubs
            </a>
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onCreate}
            className="rounded-full border-white/40 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
          >
            <Plus className="mr-2 h-4 w-4" /> Create Club
          </Button>
        </div>
      </div>
    </div>
  </section>
);
