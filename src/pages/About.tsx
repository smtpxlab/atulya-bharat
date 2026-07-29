import { Link } from "react-router-dom";
import {
  Activity,
  Award,
  Compass,
  Globe2,
  Heart,
  Landmark,
  Medal,
  MountainSnow,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/shared/PageHero";
import { StatCard } from "@/components/shared/StatCard";
import { TestimonialsCarousel } from "@/components/shared/TestimonialsCarousel";
import atulyaBharat from "@/assets/atulya-bharat.png.asset.json";

const MISSION = [
  {
    icon: Activity,
    title: "Fitness",
    body: "Run, walk or ride at your pace — challenges built around real progress, not pressure.",
  },
  {
    icon: Landmark,
    title: "Culture",
    body: "Every kilometre unlocks a story — landmarks, heritage and the soul of India's cities.",
  },
  {
    icon: Users,
    title: "Community",
    body: "Join clubs, cheer on friends, and stay inspired alongside thousands of fellow explorers.",
  },
];

const REASONS = [
  {
    icon: Compass,
    title: "Virtual City Tours",
    body: "Travel the streets of India's iconic cities as you cover distance.",
  },
  {
    icon: Medal,
    title: "Designer Medals",
    body: "Beautifully crafted finisher medals delivered to your door.",
  },
  {
    icon: Trophy,
    title: "Milestone Rewards",
    body: "E-cards, certificates and surprises that celebrate every step.",
  },
  {
    icon: Users,
    title: "Community Clubs",
    body: "Run with friends, form clubs, and grow together.",
  },
  {
    icon: MountainSnow,
    title: "Flexible Activities",
    body: "Walk, run or cycle — anywhere, anytime. You set the pace.",
  },
];

// TODO: wire to live metrics when an analytics endpoint is available.
const STATS = [
  { value: "10,000+", label: "Participants" },
  { value: "50+", label: "Cities Explored" },
  { value: "25k+", label: "Challenges Completed" },
  { value: "300+", label: "Active Clubs" },
];

const About = () => {
  return (
    <>
      <SEO
        title="About | Atulya Bharat Run"
        description="Atulya Bharat Run combines fitness, virtual travel, and India's rich cultural heritage into unforgettable running and cycling experiences."
        image={atulyaBharat.url}
      />

      <PageHero
        eyebrow="About Atulya Bharat Run"
        title={<>Explore India. <br className="hidden md:block" />One Step at a Time.</>}
        subtitle="Atulya Bharat Run combines fitness, virtual travel, and India's rich cultural heritage into unforgettable experiences."
        bgImage={atulyaBharat.url}
      >
        <Button asChild size="lg" className="rounded-full">
          <Link to="/challenges">Explore Challenges</Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="rounded-full border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white"
        >
          <Link to="/clubs">Join a Club</Link>
        </Button>
      </PageHero>

      {/* Our Story */}
      <section className="py-12 md:py-16">
        <div className="mx-auto w-full max-w-[720px] px-6 md:px-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Our Story
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy">
            Fitness that connects you to a country.
          </h2>
          <div className="mt-6 space-y-5 text-lg leading-[1.75] text-foreground/80">
            <p>
              Atulya Bharat Run was born from a simple but powerful idea: that fitness can be more
              than reps and routines. It can be a journey — through cities, through stories, through
              the cultural wealth of India.
            </p>
            <p>
              By merging virtual running and riding challenges with immersive city tours, we help
              people stay fit while discovering the unseen wonders of their own country, from the
              comfort of their neighbourhood.
            </p>
            <p>
              Whether you're an experienced runner or just lacing up for the first time, every step
              you take here is a step into India's history, heritage and heart.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-muted/40 py-12 md:py-16">
        <div className="mx-auto w-full max-w-[1280px] px-6 md:px-8">
          <div className="mx-auto max-w-[65ch] text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Our Mission
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-navy">
              Three pillars, one journey.
            </h2>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {MISSION.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-3xl border border-border bg-card p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold text-navy">{title}</h3>
                <p className="mt-2 text-foreground/75 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose */}
      <section className="py-12 md:py-16">
        <div className="mx-auto w-full max-w-[1280px] px-6 md:px-8">
          <div className="mx-auto max-w-[65ch] text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Why Choose ABR
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-navy">
              An experience that goes beyond the run.
            </h2>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {REASONS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="group rounded-3xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-navy">{title}</h3>
                <p className="mt-1.5 text-sm text-foreground/70 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className="bg-navy py-10 md:py-12 text-white">
        <div className="mx-auto w-full max-w-[1280px] px-6 md:px-8">
          <div className="mx-auto max-w-[65ch] text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              Community Impact
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold">
              A growing community across India and beyond.
            </h2>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-3xl border border-white/15 bg-white/5 p-4 md:p-5 text-center backdrop-blur"
              >
                <div className="font-display text-3xl md:text-4xl font-bold">{s.value}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-white/70">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 md:py-16">
        <div className="mx-auto w-full max-w-[1280px] px-6 md:px-8">
          <div className="mx-auto max-w-[65ch] text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Voices from the community
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-navy">
              Real stories, real journeys.
            </h2>
          </div>
          <div className="mt-12">
            <TestimonialsCarousel />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-20">
        <div className="mx-auto w-full max-w-[1280px] px-6 md:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-10 md:p-16 text-center text-primary-foreground shadow-lg">
            <Sparkles className="absolute right-6 top-6 h-8 w-8 opacity-30" aria-hidden />
            <Globe2 className="absolute left-6 bottom-6 h-10 w-10 opacity-20" aria-hidden />
            <h2 className="font-display text-3xl md:text-4xl font-bold">
              Ready to explore India, one step at a time?
            </h2>
            <p className="mx-auto mt-4 max-w-[60ch] text-base md:text-lg opacity-90">
              Pick a challenge, lace up, and let every kilometre take you somewhere new.
            </p>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="mt-8 rounded-full bg-white text-primary hover:bg-white/90"
            >
              <Link to="/challenges">Explore Challenges</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
};

export default About;
