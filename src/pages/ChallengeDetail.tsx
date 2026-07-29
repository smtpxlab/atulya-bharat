import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Info,
  BookOpen,
  Tag as TagIcon,
  
  MessageCircle,
  Share2,
  CalendarDays,
  Award,
  Clock,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";
import { SafeHtml } from "@/components/SafeHtml";
import { useChallengeDetail } from "@/features/challenges/hooks/useChallengeDetail";
import { useUserRegistration } from "@/features/challenges/hooks/useUserRegistration";
import { useActiveRegistration } from "@/features/challenges/hooks/useActiveRegistration";
import { ChallengeHero, ChallengeInfoCard } from "@/components/challenges/ChallengeHero";

import { BookNowModal } from "@/components/challenges/BookNowModal";


import { SectionNav, type SectionNavItem } from "@/components/shared/SectionNav";
import { ShareBar } from "@/components/shared/ShareBar";
import { RelatedChallenges } from "@/components/shared/RelatedChallenges";
import { ImageLightbox } from "@/components/shared/ImageLightbox";
import { SEO } from "@/components/SEO";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { absoluteUrl } from "@/lib/site";
import { stripHtml } from "@/lib/utils";
import { isChallengeExpired, formatExpiryDate } from "@/lib/challengeStatus";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


const TestimonialsCarousel = lazy(
  () => import("@/components/shared/TestimonialsCarousel"),
);

const SECTIONS: SectionNavItem[] = [
  { id: "details", label: "Challenge Details", icon: Info },
  { id: "about", label: "About Challenge", icon: BookOpen },
  
  { id: "testimonials", label: "Testimonials", icon: MessageCircle },
  { id: "share", label: "Share Challenge", icon: Share2 },
];

const formatDate = (iso: string | null) =>
  iso ? format(new Date(iso), "d MMM yyyy") : "—";

const ChallengeDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useChallengeDetail(slug);
  const challenge = data?.challenge ?? null;
  const tickets = data?.tickets ?? [];
  const notFound = !isLoading && !isError && data === null;

  const { isBooked } = useUserRegistration(challenge?.id);
  const { active: activeReg } = useActiveRegistration();
  const blockedByOtherActive =
    !!activeReg && !!challenge && activeReg.challenge_id !== challenge.id;

  const [bookOpen, setBookOpen] = useState(false);
  const [preselectTicket, setPreselectTicket] = useState<string | null>(null);

  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );


  const startingPrice = useMemo(() => {
    if (!tickets.length) return null;
    return Math.min(...tickets.map((t) => t.ticket_price));
  }, [tickets]);

  const shortDescription = useMemo(
    () => stripHtml(challenge?.description ?? "").slice(0, 220),
    [challenge?.description],
  );

  const seo = useMemo(() => {
    if (!challenge) return null;
    const fallbackDesc =
      stripHtml(challenge.description ?? "").slice(0, 160) ||
      `Join the ${challenge.name} — a ${challenge.distance} km virtual challenge.`;
    const customKeywords = (challenge.meta_keywords ?? []).filter(Boolean);
    const fallbackKeywords = [
      challenge.name,
      `${challenge.distance} km`,
      "Virtual Challenge",
      "Atulya Bharat Run",
    ].filter(Boolean) as string[];
    return {
      title: challenge.meta_title?.trim() || `${challenge.name} | Atulya Bharat Run`,
      description: challenge.meta_description?.trim() || fallbackDesc,
      keywords: customKeywords.length ? customKeywords : fallbackKeywords,
      image: challenge.cover_image_url ?? undefined,
    };
  }, [challenge]);

  useEffect(() => {
    if (!challenge || !seo) return;
    const sportsEventLd = {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: challenge.name,
      description: seo.description,
      sport: "Running",
      startDate: challenge.start_at ?? undefined,
      endDate: challenge.end_at ?? undefined,
      image: challenge.cover_image_url ?? undefined,
      url: absoluteUrl(`/challenges/${challenge.slug}`),
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      location: {
        "@type": "VirtualLocation",
        url: absoluteUrl(`/challenges/${challenge.slug}`),
      },
      organizer: {
        "@type": "Organization",
        name: "Atulya Bharat Run",
        url: absoluteUrl("/"),
      },
      offers:
        startingPrice != null
          ? {
              "@type": "Offer",
              price: startingPrice,
              priceCurrency: "INR",
              availability: "https://schema.org/InStock",
              url: absoluteUrl(`/challenges/${challenge.slug}`),
            }
          : undefined,
    };

    document.head
      .querySelectorAll('script[data-page="challenge-detail"]')
      .forEach((n) => n.remove());

    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.dataset.page = "challenge-detail";
    ld.text = JSON.stringify(sportsEventLd);
    document.head.appendChild(ld);

    return () => {
      document.head
        .querySelectorAll('script[data-page="challenge-detail"]')
        .forEach((n) => n.remove());
    };
  }, [challenge, seo, startingPrice]);


  if (notFound) {
    return (
      <section className="abr-container py-24 text-center">
        <h1 className="text-navy">Challenge not found</h1>
        <p className="mt-3 text-muted-foreground">
          It may be inactive or the link is incorrect.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/challenges">Browse all challenges</Link>
        </Button>
      </section>
    );
  }

  if (isLoading || !challenge) {
    return (
      <>
        <Skeleton className="h-[420px] w-full" />
        <div className="abr-container py-10 space-y-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  const images: { src: string; alt: string; label: string }[] = [
    challenge.route_map_image_url && {
      src: challenge.route_map_image_url,
      alt: `${challenge.name} route map`,
      label: "Route Map",
    },
  ].filter(Boolean) as { src: string; alt: string; label: string }[];


  const expired = isChallengeExpired(challenge.end_at);

  const openBook = (ticketId?: string) => {
    if (expired) return;
    if (isBooked) {
      navigate("/dashboard/challenges");
      return;
    }
    if (blockedByOtherActive) return;
    setPreselectTicket(ticketId ?? null);
    setBookOpen(true);
  };



  return (
    <main className="pb-28 md:pb-12">
      {seo && (
        <SEO
          title={seo.title}
          description={seo.description}
          keywords={seo.keywords}
          image={seo.image}
          type="website"
        />
      )}
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Challenges", href: "/challenges" },
          { name: challenge.name },
        ]}
      />
      <ChallengeHero challenge={challenge} />


      <ChallengeInfoCard
        challenge={challenge}
        startingPrice={startingPrice}
        shortDescription={shortDescription}
        onBook={() => openBook()}
        isBooked={isBooked}
      />


      {blockedByOtherActive && !isBooked && (
        <section className="abr-container pt-6">
          <div className="rounded-2xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-foreground">
            <p className="font-semibold text-secondary-foreground">
              You already have an active challenge ({activeReg?.challenge_name}).
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Complete or wait for your current challenge to expire before joining another. You can track it from your dashboard.
            </p>
            <div className="mt-2">
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Tag chips */}
      {challenge.tags.length > 0 && (
        <section className="abr-container pt-8">
          <div className="flex flex-wrap gap-2">
            {challenge.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="abr-container py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr] xl:gap-12">
          <SectionNav items={SECTIONS} />

          <div className="min-w-0 space-y-12 md:space-y-16">
            {/* Challenge Details */}
            <section id="section-details" className="scroll-mt-24">
              <h2 className="font-display text-2xl text-navy md:text-3xl">
                Challenge Details
              </h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem
                  icon={<TagIcon className="h-4 w-4" />}
                  label="Type"
                  value={challenge.challenge_type}
                />
                <DetailItem
                  icon={<MapPin className="h-4 w-4" />}
                  label="Distance"
                  value={`${challenge.distance} km`}
                />
                <DetailItem
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Starts"
                  value={formatDate(challenge.start_at)}
                />
                <DetailItem
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Ends"
                  value={formatDate(challenge.end_at)}
                />
                <DetailItem
                  icon={<Clock className="h-4 w-4" />}
                  label="Max Duration"
                  value={
                    challenge.max_duration_days
                      ? `${challenge.max_duration_days} days`
                      : "—"
                  }
                />
                <DetailItem
                  icon={<Award className="h-4 w-4" />}
                  label="Starting Price"
                  value={
                    startingPrice != null ? `₹${startingPrice} onwards` : "—"
                  }
                />
              </dl>
            </section>

            {/* About */}
            <section id="section-about" className="scroll-mt-24">
              <h2 className="font-display text-2xl text-navy md:text-3xl">
                About this Challenge
              </h2>
              {challenge.description && (
                <SafeHtml
                  html={challenge.description}
                  className="prose prose-sm mt-4 max-w-none text-foreground md:prose-base"
                />
              )}

              {images.length > 0 && (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map((img) => (
                    <button
                      key={img.src}
                      type="button"
                      onClick={() => setLightbox(img)}
                      className="group overflow-hidden rounded-3xl border border-border bg-card text-left transition hover:shadow-lg"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                        <img
                          src={img.src}
                          alt={img.alt}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <p className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        {img.label}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>




            {/* Testimonials */}
            <section id="section-testimonials" className="scroll-mt-24">
              <h2 className="font-display text-2xl text-navy md:text-3xl">
                What people are saying
              </h2>
              <div className="mt-6">
                <Suspense
                  fallback={
                    <div className="grid gap-4 md:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-44 rounded-3xl" />
                      ))}
                    </div>
                  }
                >
                  <TestimonialsCarousel />
                </Suspense>
              </div>
            </section>

            {/* Share */}
            <section id="section-share" className="scroll-mt-24">
              <h2 className="font-display text-2xl text-navy md:text-3xl">
                Share Challenge
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Help your friends discover this adventure.
              </p>
              <div className="mt-5">
                <ShareBar title={challenge.name} />
              </div>
            </section>
          </div>
        </div>
      </section>

      <RelatedChallenges excludeId={challenge.id} title="Related Challenges" />



      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <div className="abr-container flex items-center justify-between gap-3 px-0">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {challenge.name}
            </p>
            {startingPrice != null && (
              <p className="font-semibold text-primary">
                ₹{startingPrice}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  onwards
                </span>
              </p>
            )}
          </div>
          {expired ? (
            <div className="flex flex-col items-end gap-0.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        disabled
                        variant="secondary"
                        className="rounded-full px-6 min-h-11"
                      >
                        Expired
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>This challenge has expired.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <p className="text-[10px] text-muted-foreground">
                Ended {formatExpiryDate(challenge.end_at)}
              </p>
            </div>
          ) : isBooked ? (
            <Button
              asChild
              variant="secondary"
              className="rounded-full px-6 min-h-11"
            >
              <Link to="/dashboard/challenges">Booked ✓</Link>
            </Button>

          ) : blockedByOtherActive ? (
            <Button
              disabled
              variant="secondary"
              className="rounded-full px-6 min-h-11"
              title={`Active: ${activeReg?.challenge_name}`}
            >
              Another challenge active
            </Button>
          ) : (
            <Button
              onClick={() => openBook()}
              className="rounded-full px-6 min-h-11"
            >
              Book Now
            </Button>
          )}

        </div>
      </div>

      <ImageLightbox
        open={!!lightbox}
        onOpenChange={(v) => !v && setLightbox(null)}
        src={lightbox?.src ?? null}
        alt={lightbox?.alt ?? ""}
      />

      <BookNowModal
        open={bookOpen}
        onOpenChange={setBookOpen}
        challenge={challenge}
        tickets={tickets}
        preselectTicketId={preselectTicket}
      />

    </main>
  );
};

const DetailItem = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
      {icon}
    </span>
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">
        {value ?? "—"}
      </dd>
    </div>
  </div>
);

export default ChallengeDetail;
