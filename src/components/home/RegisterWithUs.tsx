import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { JaliOverlay } from "@/components/shared/JaliOverlay";

export const RegisterWithUs = () => {
  return (
    <section
      aria-labelledby="finish-line-title"
      className="abr-container py-20"
    >
      <div className="relative overflow-hidden rounded-3xl bg-surface text-surface-foreground shadow-lift p-10 md:p-16">
        <JaliOverlay opacity={0.08} />

        {/* Saffron orb */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl"
        />
        {/* Gold orb bottom-left for depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl"
        />

        <div className="relative max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            2026 Season
          </p>
          <h2
            id="finish-line-title"
            className="mt-3 font-display font-bold text-4xl sm:text-5xl text-white"
          >
            Your next finish line is a{" "}
            <span className="italic text-gold">heritage city.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white/80">
            Lock in your 2026 season challenge today.
          </p>
          <div className="mt-8">
            <Button asChild className="btn-saffron h-auto">
              <Link to="/challenges">Find your Challenge</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RegisterWithUs;
