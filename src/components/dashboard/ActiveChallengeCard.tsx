import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MapPin, Mountain, Route, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressRing } from "@/components/dashboard/ProgressRing";
import {
  getActiveRegistration,
  getProgressByRegistration,
  type ActiveRegistration,
  type ChallengeProgress,
} from "@/services/challenge-progress.service";

type Props = {
  userId: string;
  onSyncNow?: () => void;
  syncing?: boolean;
  refreshKey?: number;
};

export function ActiveChallengeCard({ userId, onSyncNow, syncing, refreshKey }: Props) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveRegistration | null>(null);
  const [progress, setProgress] = useState<ChallengeProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const a = await getActiveRegistration(userId);
      if (cancelled) return;
      setActive(a);
      if (a) {
        const p = await getProgressByRegistration(a.registration_id);
        if (!cancelled) setProgress(p);
      } else {
        setProgress(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  if (loading) return <Skeleton className="h-40 w-full rounded-3xl" />;
  if (!active || !progress) return null;

  const target = progress.distance_target_km;
  const done = progress.distance_logged_km;
  const remaining = progress.distance_remaining_km;
  const pct = progress.pct_complete;

  return (
    <article className="card-elevated overflow-hidden">
      <div className="grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Active Challenge
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
              {progress.activity_mode}
            </span>
          </div>
          <Link
            to={`/challenges/${active.challenge_slug}`}
            className="mt-2 block truncate font-display text-2xl text-navy hover:underline"
          >
            {active.challenge_name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Target className="h-3.5 w-3.5" /> Goal {target} km
            </span>
            <span className="inline-flex items-center gap-1">
              <Route className="h-3.5 w-3.5" /> {progress.activities_count} activities
            </span>
            <span className="inline-flex items-center gap-1">
              <Mountain className="h-3.5 w-3.5" /> {progress.milestones_unlocked}/{progress.milestones_total} milestones
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {progress.days_left} days left
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Completed" value={`${done.toFixed(1)} km`} accent />
            <Stat label="Remaining" value={`${remaining.toFixed(1)} km`} />
            <Stat label="Progress" value={`${pct.toFixed(1)}%`} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" className="rounded-full">
              <Link to={`/my-challenges/${active.registration_id}`}>View Progress</Link>
            </Button>
            {onSyncNow && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={onSyncNow}
                disabled={syncing}
              >
                {syncing ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Syncing
                  </>
                ) : (
                  "Sync Strava"
                )}
              </Button>
            )}
          </div>

          {progress.is_complete && (
            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
              <Trophy className="h-3.5 w-3.5" /> Challenge complete — generate your certificate!
            </p>
          )}
        </div>

        <div className="flex items-center justify-center sm:pl-4">
          <ProgressRing value={pct} />
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-display text-lg ${accent ? "text-primary" : "text-navy"}`}>
        {value}
      </div>
    </div>
  );
}
