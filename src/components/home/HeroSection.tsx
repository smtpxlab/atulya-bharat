import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EyebrowChip } from "@/components/shared/EyebrowChip";
import { StatTile } from "@/components/shared/StatTile";
import { JaliOverlay } from "@/components/shared/JaliOverlay";

const STATS = [
  { value: "120k+", label: "Active Movers", accent: "saffron" as const },
  { value: "48", label: "Heritage Cities", accent: "gold" as const },
  { value: "9.2M", label: "Kms Logged", accent: "saffron" as const },
  { value: "300+", label: "Medals Weekly", accent: "gold" as const },
];

export const HeroSection = () => {
  return (
    <section aria-labelledby="hero-title" className="abr-container pt-10 pb-6">
      <div className="relative overflow-hidden rounded-3xl bg-surface text-surface-foreground shadow-lift">
        <JaliOverlay opacity={0.08} />

        <div className="relative grid lg:grid-cols-12">
          {/* Copy column */}
          <div className="lg:col-span-7 p-8 sm:p-12 lg:p-20 flex flex-col justify-center">
            <EyebrowChip pulse>Season 2026 Live</EyebrowChip>

            <h1
              id="hero-title"
              className="mt-6 font-display font-bold text-white text-5xl sm:text-6xl lg:text-7xl leading-[1.05]"
            >
              Explore India.
              <br />
              <span className="italic text-gold">One km at a time.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base sm:text-lg text-white/80">
              Join virtual challenges mapped to real distances across Ayodhya,
              Hampi and Kashi. Unlock cultural milestones and earn authentic
              heritage medals.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild className="btn-saffron h-auto">
                <Link to="/challenges">Browse Challenges</Link>
              </Button>
              <Button asChild variant="ghost" className="btn-outline-white h-auto">
                <Link to="/about">How it works</Link>
              </Button>
            </div>
          </div>

          {/* Stats column */}
          <div className="lg:col-span-5 p-8 sm:p-12 lg:p-14 border-t lg:border-t-0 lg:border-l border-white/10 bg-white/[0.04] backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-6">
              {STATS.map((s) => (
                <StatTile
                  key={s.label}
                  value={s.value}
                  label={s.label}
                  accent={s.accent}
                  variant="navy"
                />
              ))}
            </div>

            {/* Social proof tile */}
            <div className="mt-10 flex items-center gap-4 rounded-xl border border-gold/20 bg-gold/10 p-5">
              <div className="flex -space-x-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-10 w-10 rounded-full border-2 border-surface bg-gradient-to-br from-primary to-gold"
                    aria-hidden
                  />
                ))}
                <div className="h-10 w-10 rounded-full border-2 border-surface bg-white/15 flex items-center justify-center text-[10px] font-bold text-white">
                  +4k
                </div>
              </div>
              <p className="text-xs text-white/80">
                <span className="font-bold text-white">Join 4,200 others</span>{" "}
                running the Ayodhya Challenge this week.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
