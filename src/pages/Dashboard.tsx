import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Loader2,
  MapPin,
  Medal,
  Mountain,
  Plus,
  Route,
  Zap,
} from "lucide-react";

import { Link, useNavigate, useLocation } from "react-router-dom";
import { isAuthRequiredError } from "@/services/errors";
import { format, formatDistanceToNow } from "date-fns";
import { ProgressRing } from "@/components/dashboard/ProgressRing";
import { LogActivityModal, type LogActivityValues } from "@/components/dashboard/LogActivityModal";
import {
  MilestoneUnlockScreen,
  type UnlockedMilestone,
} from "@/components/dashboard/MilestoneUnlockScreen";
import { ChallengeCompletionScreen } from "@/components/dashboard/ChallengeCompletionScreen";
import { SyncResultDialog, type SyncResult } from "@/components/dashboard/SyncResultDialog";
import { MilestoneLibraryDrawer } from "@/components/dashboard/MilestoneLibraryDrawer";
import { toast } from "sonner";
import { DashboardClubsSections } from "@/components/dashboard/DashboardClubsSections";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { ProfileSummaryCard } from "@/components/dashboard/ProfileSummaryCard";
import { ActiveChallengeCard } from "@/components/dashboard/ActiveChallengeCard";
import { useProfile } from "@/features/profile/hooks/useProfile";
import { EmptyState } from "@/components/clubs/EmptyState";
import { getProgressByRegistration } from "@/services/challenge-progress.service";
import { RelatedChallenges } from "@/components/shared/RelatedChallenges";
import { SEO } from "@/components/SEO";


type ChallengeLite = {
  id: string;
  slug: string;
  title: string;
  city: string;
  total_distance_km: number;
  cover_image_url: string | null;
  activity_modes: string[];
};

type RegistrationRow = {
  id: string;
  challenge_id: string;
  total_km_logged: number;
  status: string;
  challenge: ChallengeLite;
  next_milestone: { landmark_name: string; unlock_at_km: number } | null;
};

type ActivityLogRow = {
  id: string;
  activity_date: string;
  distance_km: number;
  activity_type: string | null;
  source: string;
  registration_id: string | null;
  challenge_title?: string;
};

type Stats = {
  total_km: number;
  active_count: number;
  milestones: number;
  completed_count: number;
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (!user) return null;
  const userId = user.id;
  const { data: profile } = useProfile();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total_km: 0, active_count: 0, milestones: 0, completed_count: 0 });
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [completedRegistrations, setCompletedRegistrations] = useState<RegistrationRow[]>([]);
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [hasStrava, setHasStrava] = useState<boolean>(false);
  const [stravaSyncedAt, setStravaSyncedAt] = useState<string | null>(null);
  const [stravaAthleteName, setStravaAthleteName] = useState<string | null>(null);
  const [stravaAthleteAvatar, setStravaAthleteAvatar] = useState<string | null>(null);
  const [stravaAthleteLocation, setStravaAthleteLocation] = useState<string | null>(null);
  const [stravaScope, setStravaScope] = useState<string | null>(null);
  const [stravaRefreshFailedAt, setStravaRefreshFailedAt] = useState<string | null>(null);
  const [stravaStats, setStravaStats] = useState<import("@/services/strava.service").StravaAthleteStats | null>(null);
  const [stravaSyncing, setStravaSyncing] = useState(false);
  const [lastSyncRun, setLastSyncRun] = useState<{
    source: string;
    started_at: string;
    finished_at: string | null;
    fetched: number;
    imported: number;
    duplicate: number;
    outside_window: number;
    wrong_sport: number;
    status: string;
    reason: string | null;
  } | null>(null);
  const [profileName, setProfileName] = useState<string>("");

  const [logModalReg, setLogModalReg] = useState<RegistrationRow | null>(null);
  const [libraryReg, setLibraryReg] = useState<RegistrationRow | null>(null);
  const [unlockQueue, setUnlockQueue] = useState<UnlockedMilestone[]>([]);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [completion, setCompletion] = useState<{ registrationId: string; challengeName: string; distanceKm: number } | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  useEffect(() => {
    document.title = "Dashboard | Atulya Bharat Run";
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);

    const [profileRes, regsRes, logsRes, milestonesUnlockedRes, stravaRes] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      supabase
        .from("registrations")
        .select(
          "id, challenge_id, total_km_logged, status, activity_mode, challenges:challenge_id (id, slug, name, distance, cover_image_url, challenge_type)",
        )
        .eq("user_id", userId),
      supabase
        .from("activity_logs")
        .select("id, activity_date, distance_km, activity_type, source, registration_id, logged_at")
        .eq("user_id", userId)
        .order("activity_date", { ascending: false })
        .order("logged_at", { ascending: false })
        .limit(50),
      supabase.from("user_milestones").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("strava_connection_status" as any)
        .select("last_synced_at, athlete_first_name, athlete_last_name, athlete_avatar_url, athlete_city, athlete_country, scope, refresh_failed_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    setProfileName(profileRes.data?.full_name ?? "");
    const stravaData = (stravaRes.data as unknown) as {
      last_synced_at: string | null;
      athlete_first_name: string | null;
      athlete_last_name: string | null;
      athlete_avatar_url: string | null;
      athlete_city: string | null;
      athlete_country: string | null;
      scope: string | null;
      refresh_failed_at: string | null;
    } | null;
    setHasStrava(!!stravaData);
    setStravaSyncedAt(stravaData?.last_synced_at ?? null);
    setStravaScope(stravaData?.scope ?? null);
    setStravaRefreshFailedAt(stravaData?.refresh_failed_at ?? null);
    setStravaAthleteName(
      stravaData
        ? [stravaData.athlete_first_name, stravaData.athlete_last_name].filter(Boolean).join(" ") || null
        : null,
    );
    setStravaAthleteAvatar(stravaData?.athlete_avatar_url ?? null);
    setStravaAthleteLocation(
      stravaData
        ? [stravaData.athlete_city, stravaData.athlete_country].filter(Boolean).join(", ") || null
        : null,
    );

    // Fetch the most recent sync run summary (for the "last sync" chip).
    if (stravaData) {
      const { data: runRows } = await supabase.rpc("last_strava_sync_run" as any, {
        _user_id: userId,
      });
      const run = Array.isArray(runRows) ? runRows[0] : runRows;
      setLastSyncRun(run ?? null);
    } else {
      setLastSyncRun(null);
    }

    // Fetch live Strava stats (athlete + totals + recent) in background.
    if (stravaData) {
      void (async () => {
        const { stravaAthleteStats } = await import("@/services/strava.service");
        const s = await stravaAthleteStats();
        if (s) {
          setStravaStats(s);
          if (s.athlete?.avatar) setStravaAthleteAvatar(s.athlete.avatar);
        }
      })();
    } else {
      setStravaStats(null);
    }

    if (regsRes.error) {
      // eslint-disable-next-line no-console
      console.warn("[Dashboard] registrations query error", regsRes.error);
    }

    const modesForRegistration = (mode: string | null | undefined, t: string | null | undefined): string[] => {
      const m = (mode ?? "").toLowerCase();
      if (m === "run") return ["Run"];
      if (m === "walk") return ["Walk"];
      if (m === "ride") return ["Ride"];
      // mode = 'any' or null → fall back to challenge_type
      if (t === "Ride") return ["Ride"];
      if (t === "Run/Walk") return ["Run", "Walk"];
      return ["Run", "Walk", "Ride"];
    };
    const toChallengeLite = (c: any, regMode: string | null | undefined): ChallengeLite => ({
      id: c?.id,
      slug: c?.slug,
      title: c?.name ?? "",
      city: "",
      total_distance_km: Number(c?.distance ?? 0),
      cover_image_url: c?.cover_image_url ?? null,
      activity_modes: modesForRegistration(regMode, c?.challenge_type),
    });

    const allRegs = (regsRes.data ?? []) as any[];
    const activeRegs = allRegs.filter((r) => r.status === "active");
    const completedRegs = allRegs.filter((r) => r.status === "completed");
    const completedCount = completedRegs.length;

    const challengeIds = [...activeRegs, ...completedRegs].map((r) => r.challenge_id);
    let milestonesByChallenge = new Map<string, { landmark_name: string; unlock_at_km: number }[]>();
    if (challengeIds.length) {
      const { data: ms } = await supabase
        .from("challenge_milestones")
        .select("challenge_id, spot_name, distance, sort_order")
        .in("challenge_id", challengeIds)
        .order("distance", { ascending: true });
      for (const m of (ms ?? []) as any[]) {
        const arr = milestonesByChallenge.get(m.challenge_id) ?? [];
        arr.push({ landmark_name: m.spot_name, unlock_at_km: Number(m.distance) });
        milestonesByChallenge.set(m.challenge_id, arr);
      }
    }

    // Source of truth for per-registration progress is the
    // `challenge_progress_by_registration` RPC (same one the detail page uses),
    // so dashboard cards stay in lock-step with /my-challenges/:id.
    const allCardRegs = [...activeRegs, ...completedRegs];
    const progressList = await Promise.all(
      allCardRegs.map((r: any) => getProgressByRegistration(r.id).catch(() => null)),
    );
    if (allCardRegs.length > 0 && progressList.some((p) => p === null)) {
      toast.warning("Some challenge progress couldn't be refreshed. Showing last-known totals.");
    }

    const buildRow = (r: any, prog: any): RegistrationRow => {
      const ms = milestonesByChallenge.get(r.challenge_id) ?? [];
      const loggedKm = prog
        ? Number(prog.distance_logged_km ?? 0)
        : Number(r.total_km_logged ?? 0);
      const next = ms.find((m) => m.unlock_at_km > loggedKm) ?? null;
      return {
        id: r.id,
        challenge_id: r.challenge_id,
        total_km_logged: loggedKm,
        status: r.status,
        challenge: toChallengeLite(r.challenges, r.activity_mode),
        next_milestone: next,
      };
    };

    setRegistrations(activeRegs.map((r, i) => buildRow(r, progressList[i])));
    setCompletedRegistrations(
      completedRegs.map((r, i) => buildRow(r, progressList[activeRegs.length + i])),
    );

    // Sum per-registration distance from the canonical RPC so the dashboard
    // tile matches the detail page even when there are more than 50 activities.
    const totalKm = progressList.reduce(
      (sum, prog, idx) =>
        sum +
        (prog
          ? Number(prog.distance_logged_km ?? 0)
          : Number(allCardRegs[idx]?.total_km_logged ?? 0)),
      0,
    );
    setStats({
      total_km: totalKm,
      active_count: activeRegs.length,
      milestones: milestonesUnlockedRes.count ?? 0,
      completed_count: completedCount,
    });

    const regTitleById = new Map<string, string>();
    for (const r of allRegs) regTitleById.set(r.id, r.challenges?.name ?? "—");
    setLogs(
      (logsRes.data ?? []).map((l) => ({
        ...l,
        challenge_title: l.registration_id ? regTitleById.get(l.registration_id) ?? "—" : "—",
      })),
    );

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const buildUnlockQueue = useCallback(
    async (milestoneIds: string[], regChallengeTitle: string, regChallengeCity: string, challengeId: string) => {
      if (milestoneIds.length === 0) return [] as UnlockedMilestone[];
      const [{ data: ms }, { data: media }, { count: totalInChallenge }] = await Promise.all([
        supabase
          .from("challenge_milestones")
          .select("id, sort_order, spot_name, description")
          .in("id", milestoneIds)
          .order("sort_order", { ascending: true }),
        supabase
          .from("milestone_media")
          .select("milestone_id, media_type, storage_url, duration_seconds, is_primary")
          .in("milestone_id", milestoneIds)
          .eq("is_primary", true),
        supabase
          .from("challenge_milestones")
          .select("id", { count: "exact", head: true })
          .eq("challenge_id", challengeId),
      ]);
      return ((ms ?? []) as any[]).map((m) => {
        const img = (media ?? []).find((x) => x.milestone_id === m.id && x.media_type === "image");
        const aud = (media ?? []).find((x) => x.milestone_id === m.id && x.media_type === "audio");
        return {
          id: m.id,
          sequence_no: m.sort_order ?? 0,
          title: m.spot_name,
          landmark_name: m.spot_name,
          description: m.description,
          image_url: img?.storage_url ?? null,
          audio_url: aud?.storage_url ?? null,
          audio_duration: aud?.duration_seconds ?? null,
          challenge_title: regChallengeTitle,
          challenge_city: regChallengeCity,
          total_in_challenge: totalInChallenge ?? milestoneIds.length,
          user_name: profileName || (user?.email ?? "Runner"),
        } as UnlockedMilestone;
      });
    },
    [profileName, user?.email],
  );

  const handleLogActivity = async (values: LogActivityValues) => {
    const reg = logModalReg;
    if (!reg) return;
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("log_manual_activity", {
      _registration_id: reg.id,
      _distance_km: values.distance_km,
      _activity_date: values.date,
      _activity_type: values.activity_type,
      _notes: values.notes ?? null,
    });
    if (rpcErr) {
      if (isAuthRequiredError(rpcErr)) {
        toast.error("Please sign in to continue.");
        navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
        return;
      }
      toast.error(rpcErr.message);
      return;
    }
    const res = (rpcRes ?? {}) as {
      total_km_logged?: number;
      newly_unlocked_milestone_ids?: string[];
    };
    const newlyIds = res.newly_unlocked_milestone_ids ?? [];

    if (newlyIds.length > 0) {
      const queue = await buildUnlockQueue(
        newlyIds,
        reg.challenge.title,
        reg.challenge.city,
        reg.challenge_id,
      );
      setUnlockQueue(queue);
      setUnlockOpen(true);
    } else {
      toast.success(`+${values.distance_km} km logged`);
    }

    await loadAll();
  };


  useEffect(() => {
    const channel = supabase
      .channel(`dash-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "registrations", filter: `user_id=eq.${userId}` },
        async (payload) => {
          const oldRow = payload.old as { status?: string } | null;
          const newRow = payload.new as { id: string; status?: string; challenge_id?: string } | null;
          if (newRow && newRow.status === "completed" && oldRow?.status !== "completed") {
            const key = `abr_celebrated_${newRow.id}`;
            if (typeof window !== "undefined" && !localStorage.getItem(key)) {
              try {
                const { data: ch } = await supabase
                  .from("challenges")
                  .select("name, distance")
                  .eq("id", newRow.challenge_id ?? "")
                  .maybeSingle();
                setCompletion({
                  registrationId: newRow.id,
                  challengeName: ch?.name ?? "Challenge",
                  distanceKm: Number(ch?.distance ?? 0),
                });
                localStorage.setItem(key, "1");
              } catch { /* ignore */ }
            }
          }
          void loadAll();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_milestones", filter: `user_id=eq.${userId}` },
        async (payload) => {
          const newRow = payload.new as { milestone_id: string; registration_id: string | null };
          setUnlockQueue((prev) => {
            if (prev.some((u) => u.id === newRow.milestone_id)) return prev;
            void (async () => {
              const { data: reg } = await supabase
                .from("registrations")
                .select("challenge_id, challenges:challenge_id (name)")
                .eq("id", newRow.registration_id ?? "")
                .maybeSingle();
              if (!reg) return;
              const ch = (reg as any).challenges;
              const items = await buildUnlockQueue([newRow.milestone_id], ch?.name ?? "", "", reg.challenge_id);
              setUnlockQueue((q) => [...q, ...items]);
              setUnlockOpen(true);
              void loadAll();
            })();
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs", filter: `user_id=eq.${userId}` },
        () => { void loadAll(); },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [userId, loadAll, buildUnlockQueue]);

  const onConnectStrava = async () => {
    const { connectStrava } = await import("@/lib/strava/connectStrava");
    await connectStrava();
  };



  const onSyncNow = async (mode?: "full") => {
    setStravaSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("strava-sync-manual", {
        body: mode ? { mode } : {},
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error ?? error?.message ?? "Sync failed");
        return;
      }
      const d = (data as any) ?? {};
      if (d.reason === "no_active_registration") {
        toast.message("No active challenge", { description: "Register for a challenge to start syncing activities." });
      } else if (d.reason === "reconnect_required") {
        toast.error("Reconnect Strava", { description: "Your Strava token has expired. Please reconnect." });
      } else {
        // Use the active registration we know about for activity_mode context.
        const activeMode =
          registrations[0]?.challenge?.activity_modes?.[0]?.toLowerCase() ?? null;
        setSyncResult({
          imported: Number(d.imported ?? d.synced ?? 0),
          fetched: Number(d.fetched ?? 0),
          duplicate: Number(d.duplicate ?? d.skippedExisting ?? 0),
          outsideWindow: Number(d.outsideWindow ?? d.skippedOutOfWindow ?? 0),
          wrongSport: Number(d.wrongSport ?? d.skippedWrongSport ?? 0),
          activityMode: activeMode,
        });
        setSyncDialogOpen(true);
      }
      await loadAll();
    } finally {
      setStravaSyncing(false);
    }
  };

  const onDisconnectStrava = async () => {
    if (!confirm("Disconnect your Strava account? Past activities remain logged.")) return;
    const { data, error } = await supabase.functions.invoke("strava-disconnect");
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Could not disconnect");
      return;
    }
    toast.success("Strava disconnected");
    setHasStrava(false);
    setStravaSyncedAt(null);
    setStravaAthleteName(null);
    setStravaAthleteAvatar(null);
    setStravaAthleteLocation(null);
    setStravaStats(null);
  };

  const stats4 = useMemo(
    () => [
      { label: "Active Runs", value: stats.active_count, Icon: Zap },
      { label: "Completed Activities", value: stats.completed_count, Icon: Medal },
      { label: "Overall Distance (km)", value: stats.total_km, Icon: Route, decimals: 1 },
      { label: "Milestones Unlocked", value: stats.milestones, Icon: Mountain },
    ],
    [stats],
  );

  const firstName = (profile?.full_name || profileName || "").split(" ")[0];

  return (
    <main>
      <SEO title="Dashboard | Atulya Bharat Run" noindex />
      <section className="abr-container py-8 md:py-10">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Dashboard
          </p>
          <h1 className="mt-1 font-display text-display-1 text-navy">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's your progress across the community and your adventures.
          </p>
        </div>


        {/* Profile summary */}
        <div className="mt-6">
          <ProfileSummaryCard profile={profile} loading={!profile && loading} email={user?.email} />
        </div>

        {/* Active challenge */}
        <div className="mt-8">
          <ActiveChallengeCard
            userId={userId}
            onSyncNow={hasStrava ? () => onSyncNow() : undefined}
            syncing={stravaSyncing}
            refreshKey={logs.length}
          />
        </div>

        {/* Stats */}
        <div className="mt-8">
          <StatsGrid stats={stats4} loading={loading} />
        </div>

        {/* Strava */}
        <div className="mt-6 space-y-3">
          {hasStrava && stravaRefreshFailedAt && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
              <div className="flex items-start gap-3">
                <Activity className="mt-0.5 h-5 w-5 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Reconnect Strava required</p>
                  <p className="text-xs text-muted-foreground">
                    We can't refresh your Strava token (last failed{" "}
                    {formatDistanceToNow(new Date(stravaRefreshFailedAt), { addSuffix: true })}).
                    New activities aren't syncing until you reconnect.
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={onConnectStrava} className="rounded-full">
                Reconnect Strava
              </Button>
            </div>
          )}
          {hasStrava ? (
            <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-4 text-sm">

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {stravaAthleteAvatar ? (
                    <img
                      src={stravaAthleteAvatar}
                      alt={stravaAthleteName ?? "Strava athlete"}
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-success/40"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20 text-success">
                      <Activity className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-semibold text-success">Strava Connected ✓</span>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {stravaAthleteName && <span className="text-foreground font-medium">{stravaAthleteName}</span>}
                      {stravaAthleteLocation && <span>· {stravaAthleteLocation}</span>}
                      {stravaSyncedAt && (
                        <span>· Last synced {formatDistanceToNow(new Date(stravaSyncedAt), { addSuffix: true })}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => onSyncNow()} disabled={stravaSyncing}>
                    {stravaSyncing ? (<><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Syncing</>) : "Sync Now"}
                  </Button>
                  <button
                    onClick={() => onSyncNow("full")}
                    disabled={stravaSyncing}
                    className="text-xs font-medium text-muted-foreground underline hover:text-foreground disabled:opacity-50"
                    title="Re-fetch full Strava history"
                  >
                    Full re-sync
                  </button>
                  <button
                    onClick={onDisconnectStrava}
                    className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
                  >
                    Deauthorize Strava
                  </button>
                </div>
              </div>
              {stravaScope && !stravaScope.includes("profile:read_all") && (
                <p className="mt-3 rounded-xl border border-secondary/40 bg-secondary/10 px-3 py-2 text-xs text-foreground">
                  Your Strava connection is missing the <code className="font-mono">profile:read_all</code> scope.{" "}
                  <button onClick={onConnectStrava} className="font-semibold underline">
                    Re-authorize Strava
                  </button>{" "}
                  to unlock full profile sync.
                </p>
              )}
              {stravaStats && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div className="rounded-xl bg-background/60 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Activities</div>
                    <div className="mt-0.5 font-display text-lg text-navy">{stravaStats.totals.all_activities}</div>
                  </div>
                  <div className="rounded-xl bg-background/60 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Distance</div>
                    <div className="mt-0.5 font-display text-lg text-navy">{stravaStats.totals.all_distance_km} km</div>
                  </div>
                  <div className="rounded-xl bg-background/60 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">This Month</div>
                    <div className="mt-0.5 font-display text-lg text-navy">{stravaStats.totals.this_month_distance_km} km</div>
                  </div>
                  <div className="rounded-xl bg-background/60 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Last 4 Weeks</div>
                    <div className="mt-0.5 font-display text-lg text-navy">{stravaStats.totals.recent_4w_distance_km} km</div>
                  </div>
                  <div className="rounded-xl bg-background/60 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">This Year</div>
                    <div className="mt-0.5 font-display text-lg text-navy">{stravaStats.totals.ytd_distance_km} km</div>
                  </div>
                </div>
              )}
              {stravaStats && stravaStats.recent.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Latest Strava Activities
                  </div>
                  <ul className="divide-y divide-success/15 rounded-xl bg-background/60">
                    {stravaStats.recent.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-foreground">{a.name}</div>
                          <div className="text-muted-foreground">
                            {a.sport_type ?? "Activity"}
                            {a.start_date ? ` · ${format(new Date(a.start_date), "dd MMM yyyy")}` : ""}
                          </div>
                        </div>
                        <div className="text-right tabular-nums text-foreground">{a.distance_km} km</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {lastSyncRun && (
                <div className="mt-4 rounded-xl bg-background/60 px-3 py-2 text-xs">
                  <div className="mb-1 flex items-center justify-between text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wide">Last sync</span>
                    <span>
                      {lastSyncRun.source} · {lastSyncRun.status}
                      {lastSyncRun.started_at
                        ? " · " + formatDistanceToNow(new Date(lastSyncRun.started_at), { addSuffix: true })
                        : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-foreground">
                    <span><span className="font-semibold">{lastSyncRun.fetched}</span> checked</span>
                    <span className="text-success"><span className="font-semibold">{lastSyncRun.imported}</span> imported</span>
                    {lastSyncRun.duplicate > 0 && (
                      <span className="text-muted-foreground"><span className="font-semibold">{lastSyncRun.duplicate}</span> duplicate</span>
                    )}
                    {lastSyncRun.outside_window > 0 && (
                      <span className="text-muted-foreground"><span className="font-semibold">{lastSyncRun.outside_window}</span> outside window</span>
                    )}
                    {lastSyncRun.wrong_sport > 0 && (
                      <span className="text-muted-foreground"><span className="font-semibold">{lastSyncRun.wrong_sport}</span> wrong sport</span>
                    )}
                    {lastSyncRun.reason && (
                      <span className="text-destructive">· {lastSyncRun.reason}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-secondary/30 bg-secondary/10 px-4 py-3">
              <div className="flex items-center gap-3 text-sm">
                <Activity className="h-5 w-5 text-secondary-foreground" />
                <p className="font-medium text-foreground">
                  Connect Strava for automatic activity syncing
                </p>
              </div>
              <Button size="sm" onClick={onConnectStrava} className="rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                Connect Strava
              </Button>
            </div>
          )}
        </div>

        {/* Current challenges */}
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-display-2 text-navy">Current challenges</h2>
              <p className="mt-1 text-sm text-muted-foreground">Track progress and unlock milestones.</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/challenges">Browse more</Link>
            </Button>
          </div>

          {loading ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[0, 1].map((i) => <Skeleton key={i} className="h-44 rounded-3xl" />)}
            </div>
          ) : registrations.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={<Zap className="h-7 w-7" />}
                title="No active challenges."
                description="Pick one and start your virtual journey across India."
                action={
                  <Button asChild className="rounded-full">
                    <Link to="/challenges">Explore challenges</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {registrations.map((r) => {
                const pct = (r.total_km_logged / Math.max(1, r.challenge.total_distance_km)) * 100;
                const remaining = Math.max(0, r.challenge.total_distance_km - r.total_km_logged);
                const nextDelta = r.next_milestone
                  ? Math.max(0, r.next_milestone.unlock_at_km - r.total_km_logged)
                  : null;
                return (
                  <article key={r.id} className="card-elevated overflow-hidden p-5">
                    <div className="flex gap-4">
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-muted">
                        {r.challenge.cover_image_url ? (
                          <img
                            src={r.challenge.cover_image_url}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grad-warm h-full w-full opacity-90" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-lg text-navy">{r.challenge.title}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {r.challenge.city}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {r.total_km_logged.toFixed(1)}
                          </span>{" "}
                          of {r.challenge.total_distance_km} km · {remaining.toFixed(1)} km to go
                        </p>
                      </div>
                      <ProgressRing value={pct} />
                    </div>

                    {r.next_milestone && (
                      <p className="mt-4 rounded-xl bg-muted/60 px-3 py-2 text-xs">
                        <span className="font-semibold text-primary">Next:</span>{" "}
                        <span className="text-foreground">{r.next_milestone.landmark_name}</span>{" "}
                        <span className="text-muted-foreground">
                          at {r.next_milestone.unlock_at_km} km — {nextDelta?.toFixed(1)} km away
                        </span>
                      </p>
                    )}

                    <div className="mt-4 flex flex-col gap-2">
                      <Button asChild className="w-full rounded-full">
                        <Link to={`/my-challenges/${r.id}`}>View Progress</Link>
                      </Button>
                      <div className="flex gap-2">
                        <Button onClick={() => setLogModalReg(r)} variant="outline" className="flex-1 rounded-full">
                          <Plus className="mr-1.5 h-4 w-4" /> Log activity
                        </Button>
                        <Button onClick={() => setLibraryReg(r)} variant="outline" className="flex-1 rounded-full">
                          View milestones
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Completed challenges */}
        {completedRegistrations.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-display-2 text-navy">Completed challenges</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Revisit your past journeys, progress reports, and certificates.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {completedRegistrations.map((r) => (
                <article key={r.id} className="card-elevated overflow-hidden p-5">
                  <div className="flex gap-4">
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-muted">
                      {r.challenge.cover_image_url ? (
                        <img
                          src={r.challenge.cover_image_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grad-warm h-full w-full opacity-90" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-display text-lg text-navy">{r.challenge.title}</p>
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <Medal className="h-3 w-3" /> Completed
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {r.total_km_logged.toFixed(1)}
                        </span>{" "}
                        of {r.challenge.total_distance_km} km finished
                      </p>
                    </div>
                    <ProgressRing value={100} />
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button asChild className="flex-1 rounded-full">
                      <Link to={`/my-challenges/${r.id}`}>View progress</Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1 rounded-full">
                      <Link to={`/my-challenges/${r.id}#section-certificate`}>View certificate</Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* My clubs */}
        <DashboardClubsSections />

        {/* Activity log */}
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-display-2 text-navy">Recent activity</h2>
              <p className="mt-1 text-sm text-muted-foreground">Newest first.</p>
            </div>
            {registrations.length > 0 && (
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setLogModalReg(registrations[0])}>
                <Plus className="mr-1.5 h-4 w-4" /> Add manual activity
              </Button>
            )}
          </div>

          <div className="relative mt-5 overflow-x-auto rounded-3xl border border-border/70 bg-card shadow-card after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-8 after:bg-gradient-to-l after:from-card after:to-transparent md:after:hidden">
            <span className="sr-only">Scroll horizontally to see all columns.</span>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : logs.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No activities logged yet.</p>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Distance</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Challenge</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t border-border/70">
                      <td className="px-4 py-3 text-foreground">
                        {format(new Date(l.activity_date), "d MMM yyyy")}
                      </td>
                      <td className="px-4 py-3 font-semibold text-navy">
                        {Number(l.distance_km).toFixed(1)} km
                      </td>
                      <td className="px-4 py-3 capitalize text-foreground">{l.activity_type ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            l.source === "strava"
                              ? "rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700"
                              : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                          }
                        >
                          {l.source === "strava" ? "Strava" : "Manual"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{l.challenge_title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </section>

      {logModalReg && (
        <LogActivityModal
          open={!!logModalReg}
          onOpenChange={(v) => !v && setLogModalReg(null)}
          challengeTitle={logModalReg.challenge.title}
          allowedModes={logModalReg.challenge.activity_modes ?? []}
          onSubmit={handleLogActivity}
          targetKm={logModalReg.challenge.total_distance_km}
          loggedKm={logModalReg.total_km_logged}
        />
      )}

      {libraryReg && (
        <MilestoneLibraryDrawer
          open={!!libraryReg}
          onOpenChange={(v) => !v && setLibraryReg(null)}
          challengeId={libraryReg.challenge_id}
          challengeTitle={libraryReg.challenge.title}
          userId={userId}
        />
      )}

      <MilestoneUnlockScreen
        milestones={unlockQueue}
        open={unlockOpen}
        onClose={() => {
          setUnlockOpen(false);
          setUnlockQueue([]);
        }}
      />

      {completion && (
        <ChallengeCompletionScreen
          open={!!completion}
          onClose={() => setCompletion(null)}
          challengeName={completion.challengeName}
          distanceKm={completion.distanceKm}
          registrationId={completion.registrationId}
        />
      )}

      <SyncResultDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        result={syncResult}
      />

      <RelatedChallenges title="Explore more challenges" />
    </main>

  );
};

export default Dashboard;
