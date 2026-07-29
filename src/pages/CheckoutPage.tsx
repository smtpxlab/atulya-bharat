import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useChallengeDetail } from "@/features/challenges/hooks/useChallengeDetail";
import { useUserRegistration } from "@/features/challenges/hooks/useUserRegistration";
import { getProfile } from "@/services/profile.service";
import { registerForChallenge } from "@/services/registration.service";
import { qk } from "@/lib/queryKeys";
import { isChallengeExpired } from "@/lib/challengeStatus";

import { ChallengeSummaryCard } from "@/components/checkout/ChallengeSummaryCard";
import { SelectionControls } from "@/components/checkout/SelectionControls";
import { AddressPanel } from "@/components/checkout/AddressPanel";
import { AuthPanel } from "@/components/checkout/AuthPanel";
import { CouponPanel, type AppliedCoupon } from "@/components/checkout/CouponPanel";
import { PriceBreakdown } from "@/components/checkout/PriceBreakdown";
import { SEO } from "@/components/SEO";

const typeOptionsFor = (t: string): string[] => {
  if (t === "Ride") return ["Ride"];
  if (t === "Run/Walk") return ["Run", "Walk"];
  return ["Run", "Walk", "Ride"];
};

const isAddressComplete = (p: any) =>
  !!(p?.full_name && p.mobile && p.house_no && p.address && p.city && p.state && p.pincode);

type CheckoutNavState = {
  challengeType?: string;
  ticketId?: string;
  durationDays?: number | "";
};

const CheckoutPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, initialized } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const navState = (location.state ?? {}) as CheckoutNavState;

  const { data, isLoading } = useChallengeDetail(slug);
  const challenge = data?.challenge ?? null;
  const tickets = data?.tickets ?? [];

  const { registration, isBooked } = useUserRegistration(challenge?.id);

  // Redirect away if already booked
  useEffect(() => {
    if (isBooked && registration) {
      navigate("/dashboard/challenges", { replace: true });
    }
  }, [isBooked, registration, navigate]);

  // Block checkout when challenge has expired
  useEffect(() => {
    if (challenge && isChallengeExpired(challenge.end_at)) {
      toast.error(
        "This challenge has expired and is no longer accepting registrations.",
      );
      navigate(`/challenges/${challenge.slug}`, { replace: true });
    }
  }, [challenge, navigate]);

  // Profile (for address) — only when signed in AND auth resolved.
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: initialized && !!user?.id,
    queryFn: () => getProfile(user!.id),
    meta: { requiresAuth: true },
  });

  const activityOptions = useMemo(
    () => (challenge ? typeOptionsFor(challenge.challenge_type) : []),
    [challenge],
  );

  // ── URL-param selections (source of truth, survives refresh AND logout) ──
  const urlActivity = searchParams.get("activity") ?? "";
  const urlTicket = searchParams.get("ticket") ?? "";
  const urlDays = searchParams.get("days") ?? "";
  const parsedDays: number | "" = urlDays === "" ? "" : Number(urlDays);

  const activityMode = urlActivity || navState.challengeType || "";
  const ticketId = urlTicket || navState.ticketId || "";
  const duration: number | "" =
    parsedDays !== "" && Number.isFinite(parsedDays)
      ? (parsedDays as number)
      : (navState.durationDays ?? "");

  const updateParams = (patch: Record<string, string | number | "" | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" || v === undefined || v === null) next.delete(k);
      else next.set(k, String(v));
    }
    setSearchParams(next, { replace: true });
  };

  const setActivityMode = (v: string) => updateParams({ activity: v });
  const setTicketId = (v: string) => updateParams({ ticket: v });
  const setDuration = (v: number | "") => updateParams({ days: v });

  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Seed defaults from challenge data if URL is bare
  useEffect(() => {
    if (!activityMode && activityOptions[0]) {
      updateParams({ activity: activityOptions[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityOptions.join("|")]);
  useEffect(() => {
    if (!ticketId && tickets[0]) {
      updateParams({ ticket: tickets[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets.map((t) => t.id).join("|")]);

  // Logout watcher — clear user-specific state; keep ticket/activity/days.
  useEffect(() => {
    if (!initialized) return;
    if (!user) setCoupon(null);
  }, [initialized, user]);

  useEffect(() => {
    document.title = challenge
      ? `Checkout · ${challenge.name} | Atulya Bharat Run`
      : "Checkout | Atulya Bharat Run";
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, nofollow";
  }, [challenge]);

  const ticket = tickets.find((t) => t.id === ticketId) ?? null;
  const subtotal = ticket ? Number(ticket.ticket_price) : 0;
  const couponDiscount = coupon?.discount ?? 0;
  const promoterDiscount = 0;
  const clubDiscount = 0;
  const payable = Math.max(
    0,
    subtotal - couponDiscount - promoterDiscount - clubDiscount,
  );

  const maxDays = challenge?.max_duration_days ?? null;
  const durationError = (() => {
    if (duration === "") return "Enter number of days";
    if (!Number.isInteger(duration) || (duration as number) < 1) return "Must be at least 1 day";
    if (maxDays && (duration as number) > maxDays) return `Must be ${maxDays} days or fewer`;
    return undefined;
  })();

  const addressOk = isAddressComplete(profileQuery.data);
  const canSubmit =
    !!user &&
    !!challenge &&
    !!ticket &&
    !!activityMode &&
    !durationError &&
    addressOk &&
    !submitting;

  const returnTo = slug
    ? `${location.pathname}${location.search}`
    : "/";

  const handleSubmit = async () => {
    if (!user) return toast.error("Please log in to continue.");
    if (!canSubmit || !challenge || !ticket || duration === "") return;
    setSubmitting(true);
    try {
      await registerForChallenge({
        challenge_id: challenge.id,
        ticket_id: ticket.id,
        activity_mode: activityMode.toLowerCase() as "any" | "ride" | "run" | "walk",
        target_days: Number(duration),
        coupon_code: coupon?.coupon_name ?? null,
        promoter_discount_paise: 0,
        club_discount_paise: 0,
        challengeTitle: challenge.name,
        userEmail: user.email ?? undefined,
      });
      toast.success("Challenge booked successfully.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.challenges.detail(challenge.slug) }),
        queryClient.invalidateQueries({ queryKey: ["registrations"] }),
      ]);
      navigate("/dashboard/challenges");
    } catch (e: any) {
      if (e?.code === "user_cancelled") {
        toast.message("Payment cancelled");
      } else {
        toast.error(e?.message ?? "Booking failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !challenge) {
    return (
      <section className="abr-container py-10">
        <Skeleton className="h-8 w-1/3" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </section>
    );
  }

  return (
    <main className="pb-36 md:pb-12">
      <SEO title="Checkout | Atulya Bharat Run" noindex />
      <section className="abr-container pt-6">
        <Link
          to={`/challenges/${challenge.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to challenge
        </Link>
        <h1 className="mt-3 font-display text-3xl text-navy md:text-4xl">
          Checkout
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm your selections to book this challenge.
        </p>
      </section>

      <section className="abr-container mt-6 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start xl:gap-8">
        {/* Left column */}
        <div className="space-y-6 min-w-0">
          <CouponPanel
            subtotal={subtotal}
            applied={coupon}
            onChange={setCoupon}
          />

          <AuthPanel returnTo={returnTo} />

          {user ? (
            <AddressPanel
              profile={(profileQuery.data as any) ?? null}
              userId={user.id}
              onSaved={() =>
                queryClient.invalidateQueries({ queryKey: ["profile", user.id] })
              }
            />
          ) : (
            <section className="rounded-2xl border border-border bg-card p-5 opacity-75">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-lg text-navy">Billing Address</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in above to add your billing address.
              </p>
            </section>
          )}
        </div>

        {/* Right column */}
        <aside className="space-y-5 lg:sticky lg:top-24">
          <ChallengeSummaryCard
            challenge={challenge}
            ticket={ticket}
            activityMode={activityMode}
            durationDays={duration}
          />

          <SelectionControls
            challenge={challenge}
            tickets={tickets}
            activityOptions={activityOptions}
            activityMode={activityMode}
            onActivityChange={setActivityMode}
            ticketId={ticketId}
            onTicketChange={setTicketId}
            durationDays={duration}
            onDurationChange={setDuration}
            durationError={durationError}
          />

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg text-navy">Order summary</h2>
            <div className="mt-3">
              <PriceBreakdown
                subtotal={subtotal}
                couponDiscount={couponDiscount}
                promoterDiscount={promoterDiscount}
                clubDiscount={clubDiscount}
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="mt-5 hidden w-full rounded-full min-h-11 md:flex"
              size="lg"
            >
              {submitting ? "Processing…" : `Complete Booking · ₹${payable.toFixed(2)}`}
            </Button>
            <p className="mt-2 hidden items-center justify-center gap-1 text-xs text-muted-foreground md:flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              Payments will be enabled shortly · test mode
            </p>
            {!user && (
              <p className="mt-2 text-xs text-destructive">
                Log in to complete your booking.
              </p>
            )}
            {user && !addressOk && (
              <p className="mt-2 text-xs text-destructive">
                Add a billing address to continue.
              </p>
            )}
          </section>
        </aside>
      </section>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <div className="abr-container flex items-center justify-between gap-3 px-0">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              Amount Payable
            </p>
            <p className="font-semibold text-primary">₹{payable.toFixed(2)}</p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-full min-h-11 px-6"
          >
            {submitting ? "Processing…" : "Complete Booking"}
          </Button>
        </div>
      </div>
    </main>
  );
};

export default CheckoutPage;
