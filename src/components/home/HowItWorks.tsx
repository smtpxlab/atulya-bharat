import { Link } from "react-router-dom";
import {
  Compass,
  Target,
  Activity,
  Footprints,
  Award,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import howItWorksImg from "@/assets/how-it-works.jpg";

type Step = { title: string; Icon: LucideIcon };

const steps: Step[] = [
  { title: "Choose your challenge", Icon: Compass },
  { title: "Set your goal", Icon: Target },
  { title: "Connect Strava", Icon: Activity },
  { title: "Run, walk, or ride", Icon: Footprints },
  { title: "Unlock milestones", Icon: Award },
];

export const HowItWorks = () => {
  return (
    <section
      aria-labelledby="how-it-works-title"
      className="abr-container section-y"
    >
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="bg-muted/40 p-6 sm:p-10 lg:p-12">
            <div className="aspect-square w-full overflow-hidden rounded-2xl">
              <img
                src={howItWorksImg}
                alt="Isometric illustration of runners and cyclists exploring an Indian heritage city with route maps and milestone pins"
                width={1024}
                height={1024}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="p-6 sm:p-10 lg:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Get started
            </p>
            <h2 id="how-it-works-title" className="mt-2 text-navy">
              How It Works
            </h2>
            <p className="prose-narrow mt-3 text-base text-muted-foreground">
              Five steps from sign-up to your first milestone.
            </p>

            <ol className="relative mt-8 space-y-4">
              <span
                aria-hidden
                className="absolute left-[18px] top-2 bottom-2 w-px bg-border"
              />
              {steps.map((s, i) => (
                <li key={s.title} className="relative flex items-center gap-4">
                  <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
                    {i + 1}
                  </span>
                  <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm">
                    <s.Icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-navy sm:text-base">
                      {s.title}
                    </span>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/challenges">Start Your Journey</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
