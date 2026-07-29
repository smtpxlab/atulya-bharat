import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/Avatar";
import { SafeHtml } from "@/components/SafeHtml";
import {
  Info,
  BookOpen,
  Users,
  MessageCircle,
  Share2,
  Crown,
  Calendar,
  MapPin,
  Mail,
  Phone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useClubBySlug,
  useClubMembers,
  useJoinClub,
  useLeaveClub,
  useMyClubMemberships,
} from "@/features/clubs/hooks/useClubs";
import { SectionNav, type SectionNavItem } from "@/components/shared/SectionNav";
import { ShareBar } from "@/components/shared/ShareBar";
import { SocialIcons } from "@/components/clubs/SocialIcons";
import { MembersGrid } from "@/components/clubs/MembersGrid";
import { stripHtml } from "@/lib/utils";
import { RelatedClubs } from "@/components/shared/RelatedClubs";
import { SEO } from "@/components/SEO";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { absoluteUrl } from "@/lib/site";

const TestimonialsCarousel = lazy(
  () => import("@/components/shared/TestimonialsCarousel"),
);

const SECTIONS: SectionNavItem[] = [
  { id: "details", label: "Club Details", icon: Info },
  { id: "about", label: "About Club", icon: BookOpen },
  { id: "members", label: "Members", icon: Users },
  { id: "testimonials", label: "Testimonials", icon: MessageCircle },
  { id: "share", label: "Share Club", icon: Share2 },
];

const ClubDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: club, isLoading } = useClubBySlug(slug);
  const { data: members = [] } = useClubMembers(club?.id);
  const { data: myMemberships = [] } = useMyClubMemberships(user?.id);
  const join = useJoinClub();
  const leave = useLeaveClub();

  const isMember = useMemo(
    () => (club ? myMemberships.includes(club.id) : false),
    [club, myMemberships],
  );

  const shortPromoter = useMemo(
    () => stripHtml(club?.promoter_description ?? "").slice(0, 200),
    [club?.promoter_description],
  );

  const seo = useMemo(() => {
    if (!club) return null;
    const fallbackDesc =
      stripHtml(club.description ?? "").slice(0, 160) ||
      `Join ${club.name} on Atulya Bharat Run.`;
    const customKeywords = (club.meta_keywords ?? []).filter(Boolean);
    const fallbackKeywords = [
      club.name,
      club.promoter_city ?? undefined,
      "Running Club",
      "Atulya Bharat Run",
    ].filter(Boolean) as string[];
    return {
      title: club.meta_title?.trim() || `${club.name} | Atulya Bharat Run`,
      description: club.meta_description?.trim() || fallbackDesc,
      keywords: customKeywords.length ? customKeywords : fallbackKeywords,
      image: club.banner_url ?? undefined,
    };
  }, [club]);

  useEffect(() => {
    if (!club || !seo) return;
    const clubLd = {
      "@context": "https://schema.org",
      "@type": "SportsClub",
      name: club.name,
      description: seo.description,
      url: absoluteUrl(`/clubs/${club.slug}`),
      image: club.banner_url ?? undefined,
      logo: club.logo_url ?? undefined,
      sport: club.club_type ?? "Running",
      ...(club.promoter_city || club.promoter_state
        ? {
            address: {
              "@type": "PostalAddress",
              addressLocality: club.promoter_city ?? undefined,
              addressRegion: club.promoter_state ?? undefined,
              addressCountry: "IN",
            },
          }
        : {}),
      ...(club.promoter_email
        ? { email: club.promoter_email }
        : {}),
      ...(club.promoter_phone
        ? { telephone: club.promoter_phone }
        : {}),
      ...(club.social_links?.length
        ? { sameAs: club.social_links.filter(Boolean) }
        : {}),
    };

    document.head
      .querySelectorAll('script[data-page="club-detail"]')
      .forEach((n) => n.remove());

    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.dataset.page = "club-detail";
    ld.text = JSON.stringify(clubLd);
    document.head.appendChild(ld);

    return () => {
      document.head
        .querySelectorAll('script[data-page="club-detail"]')
        .forEach((n) => n.remove());
    };
  }, [club, seo]);


  if (isLoading) {
    return (
      <main className="abr-container py-10 space-y-6">
        <Skeleton className="h-72 w-full rounded-3xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </main>
    );
  }

  if (!club) {
    return (
      <main className="abr-container py-20 text-center">
        <h1 className="text-navy">Club not found</h1>
        <p className="mt-3 text-muted-foreground">
          It may be private, pending approval, or no longer exist.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/clubs">Browse clubs</Link>
        </Button>
      </main>
    );
  }

  const handleJoin = () => {
    if (!user) {
      toast.message("Please log in to join this club.");
      navigate(`/login?redirect=/clubs/${slug}`);
      return;
    }
    join.mutate({ clubId: club.id, userId: user.id });
  };

  const handleLeave = () => {
    if (!user || !club) return;
    if (!confirm(`Leave ${club.name}?`)) return;
    leave.mutate({ clubId: club.id, userId: user.id });
  };

  const establishedYear = club.established_at
    ? new Date(club.established_at).getFullYear()
    : null;

  const infoCard = (
    <div className="rounded-3xl bg-background p-6 shadow-xl ring-1 ring-border md:p-8">
      <div className="flex flex-wrap items-center gap-2">
        {club.club_type && (
          <Badge className="rounded-full bg-secondary text-secondary-foreground hover:bg-secondary">
            {club.club_type}
          </Badge>
        )}
        {club.priority > 0 && (
          <Badge className="rounded-full bg-primary text-primary-foreground hover:bg-primary">
            <Sparkles className="mr-1 h-3 w-3" /> Featured
          </Badge>
        )}
      </div>

      <h1 className="mt-3 font-display text-3xl text-navy md:text-4xl">
        {club.name}
      </h1>

      {club.promoter_name && (
        <p className="mt-2 text-sm text-muted-foreground">
          by{" "}
          <span className="font-medium text-foreground">
            {club.promoter_name}
          </span>
        </p>
      )}

      {shortPromoter && (
        <p className="mt-3 line-clamp-3 text-sm text-foreground/80 md:text-base">
          {shortPromoter}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {isMember ? (
          <Button
            variant="outline"
            onClick={handleLeave}
            disabled={leave.isPending}
            className="rounded-full min-h-11"
          >
            Joined ✓ · Leave
          </Button>
        ) : (
          <Button
            onClick={handleJoin}
            disabled={join.isPending}
            className="rounded-full min-h-11 px-7"
            size="lg"
          >
            Join Club
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <main className="pb-28 md:pb-12">
      {seo && (
        <SEO
          title={seo.title}
          description={seo.description}
          keywords={seo.keywords}
          image={seo.image}
        />
      )}
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Clubs", href: "/clubs" },
          { name: club.name },
        ]}
      />
      {/* Hero banner */}
      <section className="relative isolate overflow-hidden bg-muted">
        <div className="relative h-[260px] w-full md:h-[380px] lg:h-[440px]">
          {club.banner_url ? (
            <img
              src={club.banner_url}
              alt={`${club.name} banner`}
              className="absolute inset-0 h-full w-full object-cover"
              fetchPriority="high"
            />
          ) : (
            <div className="grad-hero absolute inset-0" />
          )}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
          />
        </div>
      </section>


      <section className="abr-container py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr] xl:gap-12">
          {/* LEFT SIDEBAR */}
          <aside className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
            <SectionNav items={SECTIONS} />
          </aside>


          <div className="min-w-0 space-y-12 md:space-y-16">
            {/* Info card */}
            {infoCard}

            {/* Club Details */}
            <section id="section-details" className="scroll-mt-[120px]">
              <h2 className="font-display text-2xl text-navy md:text-3xl">
                Club Details
              </h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Detail
                  icon={<Crown className="h-4 w-4" />}
                  label="Promoter"
                  value={club.promoter_name}
                />
                {establishedYear && (
                  <Detail
                    icon={<Calendar className="h-4 w-4" />}
                    label="Established"
                    value={String(establishedYear)}
                  />
                )}
                {(club.promoter_city || club.promoter_state) && (
                  <Detail
                    icon={<MapPin className="h-4 w-4" />}
                    label="Location"
                    value={[club.promoter_city, club.promoter_state]
                      .filter(Boolean)
                      .join(", ")}
                  />
                )}
                <Detail
                  icon={<Users className="h-4 w-4" />}
                  label="Members"
                  value={String(club.member_count)}
                />
                {club.promoter_email && (
                  <Detail
                    icon={<Mail className="h-4 w-4" />}
                    label="Email"
                    value={
                      <a
                        className="text-primary hover:underline break-all"
                        href={`mailto:${club.promoter_email}`}
                      >
                        {club.promoter_email}
                      </a>
                    }

                  />
                )}
                {club.promoter_phone && (
                  <Detail
                    icon={<Phone className="h-4 w-4" />}
                    label="Phone"
                    value={
                      <a
                        className="text-primary hover:underline break-all"
                        href={`tel:${club.promoter_phone}`}
                      >
                        {club.promoter_phone}
                      </a>
                    }

                  />
                )}
              </dl>
            </section>

            {/* About */}
            <section id="section-about" className="scroll-mt-[120px]">
              <h2 className="font-display text-2xl text-navy md:text-3xl">
                About this Club
              </h2>
              <div className="mt-4">
                {club.description ? (
                  <SafeHtml
                    html={club.description}
                    className="prose prose-sm max-w-none text-foreground md:prose-base"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The promoter hasn't added a description yet.
                  </p>
                )}
              </div>

              {club.promoter_description && (
                <div className="mt-8 rounded-3xl border border-border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <Avatar
                      url={null}
                      name={club.promoter_name ?? "Promoter"}
                      size={48}
                    />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Promoter
                      </p>
                      <p className="font-display text-base text-navy">
                        {club.promoter_name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 prose prose-sm max-w-none text-foreground">
                    <SafeHtml html={club.promoter_description} />
                  </div>
                </div>
              )}
            </section>

            {/* Members */}
            <section id="section-members" className="scroll-mt-[120px]">
              <div className="flex items-end justify-between">
                <h2 className="font-display text-2xl text-navy md:text-3xl">
                  Members
                </h2>
                <span className="text-xs text-muted-foreground">
                  {club.member_count} total
                </span>
              </div>
              <div className="mt-6">
                <MembersGrid members={members} clubName={club.name} />
              </div>
            </section>

            {/* Testimonials */}
            <section id="section-testimonials" className="scroll-mt-[120px]">
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
            <section id="section-share" className="scroll-mt-[120px]">
              <h2 className="font-display text-2xl text-navy md:text-3xl">
                Share Club
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Spread the word and grow the community.
              </p>
              <div className="mt-5">
                <ShareBar title={club.name} />
              </div>
            </section>

            {/* Tags & social links (bottom of page) */}
            <div className="space-y-6">
              {club.tags.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {club.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {club.social_links?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Social Links
                  </p>
                  <SocialIcons links={club.social_links} />
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <div className="abr-container flex items-center gap-2 px-0">
          {isMember ? (
            <Button
              variant="outline"
              className="flex-1 rounded-full min-h-11"
              onClick={handleLeave}
              disabled={leave.isPending}
            >
              Joined ✓
            </Button>
          ) : (
            <Button
              className="flex-1 rounded-full min-h-11"
              onClick={handleJoin}
              disabled={join.isPending}
            >
              Join Club
            </Button>
          )}
        </div>
      </div>

      <RelatedClubs excludeId={club.id} title="Related Clubs" />
    </main>

  );
};

const Detail = ({
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
      <dd className="mt-0.5 text-sm font-semibold text-foreground break-words">
        {value ?? "—"}
      </dd>

    </div>
  </div>
);

export default ClubDetail;
