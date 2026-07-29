import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  Info,
  Share2,
  Map as MapIcon,
  Mountain,
  Award,
  ListChecks,
  Trophy,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useRegistrationDetail, useInvalidateRegistration } from "@/features/registrations/hooks/useRegistrationDetail";
import { SectionNav, type SectionNavItem } from "@/components/shared/SectionNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SafeHtml } from "@/components/SafeHtml";
import { stripHtml } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { StatsSection } from "@/components/registration/StatsSection";
import { ParticipationShareCard } from "@/components/registration/ParticipationShareCard";
import { RouteMapSection } from "@/components/registration/RouteMapSection";
import { MilestonesSection } from "@/components/registration/MilestonesSection";
import { BibSection } from "@/components/registration/BibSection";
import { ActivitiesTable } from "@/components/registration/ActivitiesTable";
import { CertificateSection } from "@/components/registration/CertificateSection";
import { ChallengeCompletionScreen } from "@/components/dashboard/ChallengeCompletionScreen";
import { SyncResultDialog, type SyncResult } from "@/components/dashboard/SyncResultDialog";
import { useRegistrationRealtime } from "@/features/registrations/hooks/useRegistrationRealtime";

const RegistrationDetail = () => {
  const { registrationId } = useParams<{ registrationId: string }>();
  const { user } = useAuth();
  const userId = user?.id;
  const { data, isLoading, isError } = useRegistrationDetail(registrationId, userId);
  const invalidate = useInvalidateRegistration();
  const [syncing, setSyncing] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [hasStrava, setHasStrava] = useState<boolean | null>(null);
  const [stravaRefreshFailedAt, setStravaRefreshFailedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from("strava_connection_status" as any)
        .select("user_id, refresh_failed_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      const r = row as { user_id?: string; refresh_failed_at?: string | null } | null;
      setHasStrava(!!r?.user_id);
      setStravaRefreshFailedAt(r?.refresh_failed_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const onConnectStrava = async () => {
    const { connectStrava } = await import("@/lib/strava/connectStrava");
    await connectStrava();
  };


  useEffect(() => {
    document.title = data?.challenge?.name
      ? `${data.challenge.name} | My Challenge`
      : "My Challenge";
  }, [data?.challenge?.name]);

  // Single source of realtime invalidation (registrations / activity_logs / user_milestones).
  useRegistrationRealtime(registrationId);

  // Detect completion transition from the cached registration row.
  useEffect(() => {
    if (!registrationId) return;
    if (data?.registration?.status !== "completed") return;
    const key = `abr_celebrated_${registrationId}`;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(key)) return;
    setCompletionOpen(true);
    localStorage.setItem(key, "1");
  }, [registrationId, data?.registration?.status]);

  if (!userId) return <Navigate to="/login" replace />;

  if (isLoading) return <RegistrationSkeleton />;

  if (isError || !data) {
    return (
      <div className="container py-16 text-center">
        <h1 className="font-display text-2xl text-navy">Registration not found</h1>
        <p className="mt-2 text-muted-foreground">It may have been removed, or it does not belong to your account.</p>
        <Button asChild className="mt-6"><Link to="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  const { registration, challenge, progress, milestones, activities, profile } = data;
  const athleteName = profile?.full_name || user.email?.split("@")[0] || "Athlete";
  const isComplete = (progress?.is_complete ?? false) || registration.status === "completed";

  const sections: SectionNavItem[] = [
    { id: "overview", label: "Overview", icon: Info },
    { id: "share", label: "Share", icon: Share2 },
    { id: "route", label: "Route Map", icon: MapIcon },
    { id: "milestones", label: "Milestones", icon: Mountain },
    { id: "bib", label: "BIB", icon: Award },
    { id: "activities", label: "Activities", icon: ListChecks },
    { id: "certificate", label: "Certificate", icon: Trophy },
  ];

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("strava-sync-manual", { body: {} });
      if (error) throw error;
      const d = (data as any) ?? {};
      if (d.reason === "no_active_registration") {
        toast.message("No active challenge", { description: "Register for a challenge to start syncing." });
      } else if (d.reason === "reconnect_required") {
        toast.error("Reconnect Strava", { description: "Your Strava token has expired." });
      } else {
        setSyncResult({
          imported: Number(d.imported ?? d.synced ?? 0),
          fetched: Number(d.fetched ?? 0),
          duplicate: Number(d.duplicate ?? d.skippedExisting ?? 0),
          outsideWindow: Number(d.outsideWindow ?? d.skippedOutOfWindow ?? 0),
          wrongSport: Number(d.wrongSport ?? d.skippedWrongSport ?? 0),
          activityMode: registration.activity_mode ?? null,
        });
        setSyncDialogOpen(true);
      }
      invalidate(registration.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed. Make sure Strava is connected.");
    } finally {
      setSyncing(false);
    }
  };


  const description = challenge.description ?? "";
  const plainDesc = stripHtml(description);
  const long = plainDesc.length > 280;
  const statusBadge: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-primary/15 text-primary" },
    completed: { label: "Completed", className: "bg-success/15 text-success" },
    expired: { label: "Expired", className: "bg-muted text-muted-foreground" },
    cancelled: { label: "Cancelled", className: "bg-destructive/15 text-destructive" },
  };
  const sb = statusBadge[registration.status] ?? statusBadge.active;

  return (
    <div className="container py-6 lg:py-10">
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link to="/dashboard" className="inline-flex items-center text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" /> Dashboard
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground">{challenge.name}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {challenge.cover_image_url && (
              <img src={challenge.cover_image_url} alt={challenge.name} className="block aspect-[4/3] w-full object-cover" />
            )}
            <div className="space-y-2 p-4">
              <Badge className={sb.className}>{sb.label}</Badge>
              <h1 className="font-display text-xl text-navy">{challenge.name}</h1>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{challenge.challenge_type ?? "Mixed"}</span>
                <span>·</span>
                <span>{challenge.distance} KM</span>
                {challenge.max_duration_days && (
                  <>
                    <span>·</span>
                    <span>{challenge.max_duration_days} days</span>
                  </>
                )}
              </div>
              {hasStrava === false ? (
                <Button onClick={onConnectStrava} size="sm" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  Connect Strava
                </Button>
              ) : hasStrava && stravaRefreshFailedAt ? (
                <Button onClick={onConnectStrava} size="sm" className="w-full">
                  Reconnect Strava
                </Button>
              ) : (
                <Button onClick={handleSync} disabled={syncing || hasStrava === null} size="sm" className="w-full">
                  {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sync Strava
                </Button>
              )}
            </div>
          </div>

          <SectionNav items={sections} />
        </aside>

        <main className="space-y-10">
          <section id="section-info" className="space-y-3">
            {isComplete && (
              <div className="inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
                <Trophy className="h-3.5 w-3.5" /> Challenge Completed
              </div>
            )}
            <h2 className="font-display text-3xl text-navy">{challenge.name}</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {challenge.challenge_type && (
                <span className="rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground">
                  {challenge.challenge_type}
                </span>
              )}
              <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
                Target {challenge.distance} KM
              </span>
              {challenge.max_duration_days && (
                <span className="rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground">
                  {challenge.max_duration_days} Days
                </span>
              )}
              <span className="rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground">
                Joined {format(new Date(registration.registered_at), "d MMM yyyy")}
              </span>
            </div>
            {description && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className={`prose prose-sm max-w-none text-foreground ${!readMore && long ? "line-clamp-4" : ""}`}>
                  <SafeHtml html={description} />
                </div>
                {long && (
                  <button
                    type="button"
                    onClick={() => setReadMore((v) => !v)}
                    className="mt-2 text-sm font-medium text-primary hover:underline"
                  >
                    {readMore ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            )}
          </section>

          <StatsSection registration={registration} challenge={challenge} progress={progress ?? null} />

          <ParticipationShareCard
            templateUrl={challenge.creative_image_url}
            challengeName={challenge.name}
            registrationId={registration.id}
            userId={userId}
            initialPhotoUrl={registration.participation_photo_url}
            onPhotoChange={() => invalidate(registration.id)}
          />

          <RouteMapSection
            routeImageUrl={challenge.route_map_image_url}
            milestones={milestones}
            distanceLoggedKm={progress?.distance_logged_km ?? 0}
            distanceTargetKm={progress?.distance_target_km ?? challenge.distance}
            pctComplete={progress?.pct_complete ?? 0}
            challengeDistanceKm={challenge.distance}
          />

          <MilestonesSection
            milestones={milestones}
            distanceLoggedKm={progress?.distance_logged_km ?? 0}
          />

          <BibSection
            templateUrl={challenge.bib_image_url}
            athleteName={athleteName}
            registrationId={registration.id}
            registeredAt={registration.registered_at}
            distanceKm={challenge.distance}
            challengeName={challenge.name}
            overlayConfig={challenge.bib_overlay_config}
            bibNumber={registration.bib_number}
          />

          <ActivitiesTable activities={activities} />

          <CertificateSection
            templateUrl={challenge.certificate_image_url}
            registrationId={registration.id}
            athleteName={athleteName}
            challengeName={challenge.name}
            distanceKm={challenge.distance}
            registeredAt={registration.registered_at}
            completionDate={progress?.last_activity_date ?? null}
            isComplete={isComplete}
            distanceLoggedKm={progress?.distance_logged_km ?? 0}
            certificateNumber={registration.certificate_number}
          />

        </main>
      </div>

      {completionOpen && (
        <ChallengeCompletionScreen
          open={completionOpen}
          onClose={() => setCompletionOpen(false)}
          challengeName={challenge.name}
          distanceKm={challenge.distance}
          registrationId={registration.id}
        />
      )}
      <SyncResultDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        result={syncResult}
      />
    </div>
  );
};

function RegistrationSkeleton() {
  return (
    <div className="container py-6 lg:py-10">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-80 w-full rounded-2xl" />
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default RegistrationDetail;
