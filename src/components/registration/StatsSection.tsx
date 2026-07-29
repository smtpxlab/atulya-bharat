import { Clock, Route, Trophy } from "lucide-react";
import type { ChallengeProgress } from "@/services/challenge-progress.service";
import type { RegistrationChallenge, RegistrationRow } from "@/services/registration-detail.service";

type Props = {
  registration: RegistrationRow;
  challenge: RegistrationChallenge;
  progress: ChallengeProgress | null;
};

const dayMs = 24 * 60 * 60 * 1000;

export function StatsSection({ registration, challenge, progress }: Props) {
  const target = Number(progress?.distance_target_km ?? challenge.distance ?? 0);
  const done = Number(progress?.distance_logged_km ?? 0);

  const regAtMs = new Date(registration.registered_at).getTime();

  // True challenge window end: the earliest of
  //   - challenge.end_at
  //   - registered_at + target_days (user-chosen duration)
  //   - registered_at + max_duration_days
  // NOT progress.window_end (which the RPC clamps to today for "logged-up-to" math).
  const candidateEnds: number[] = [];
  if (challenge.end_at) candidateEnds.push(new Date(challenge.end_at).getTime());
  if (registration.target_days && registration.target_days > 0) {
    candidateEnds.push(regAtMs + registration.target_days * dayMs);
  }
  if (challenge.max_duration_days && challenge.max_duration_days > 0) {
    candidateEnds.push(regAtMs + challenge.max_duration_days * dayMs);
  }
  const windowEndMs =
    candidateEnds.length > 0
      ? Math.min(...candidateEnds)
      : regAtMs + 30 * dayMs;

  const totalDays = Math.max(1, Math.ceil((windowEndMs - regAtMs) / dayMs));
  const elapsedDays = Math.max(
    0,
    Math.min(totalDays, Math.ceil((Date.now() - regAtMs) / dayMs)),
  );

  const msLeft = Math.max(0, windowEndMs - Date.now());
  const timeLeftLabel =
    msLeft >= dayMs
      ? `${Math.ceil(msLeft / dayMs)} Days`
      : msLeft > 0
        ? `${Math.ceil(msLeft / 60000)} Minutes`
        : "0 Minutes";

  const isComplete = Boolean(progress?.is_complete) || registration.status === "completed";
  const distancePct = isComplete
    ? 100
    : Math.min(100, Number(progress?.pct_complete ?? 0));
  const timePct = Math.max(
    0,
    Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
  );

  const empty = (progress?.activities_count ?? 0) === 0;

  return (
    <section id="section-overview" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-2xl text-navy">Challenge Statistics</h2>
        {isComplete && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
            <Trophy className="h-3.5 w-3.5" /> Challenge Completed
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Distance Covered" value={`${done.toFixed(2)} km / ${target} km`} />
        <Tile label="Time Goal" value={`${totalDays} Days`} />
        <Tile label="Time Left" value={timeLeftLabel} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <BigProgressCard
          theme="success"
          icon={<Route className="h-5 w-5" />}
          title="Distance"
          value={`${distancePct.toFixed(2)}%`}
          pct={distancePct}
          footer={`Distance Covered · ${done.toFixed(2)} / ${target} km`}
        />
        <BigProgressCard
          theme="destructive"
          icon={<Clock className="h-5 w-5" />}
          title="Time Elapsed"
          value={`${timePct}%`}
          pct={timePct}
          footer={`Time Used · ${elapsedDays} / ${totalDays} Days`}
        />
      </div>

      {empty && (
        <p className="text-sm text-muted-foreground">
          No activities recorded yet. Connect and sync Strava to start tracking progress.
        </p>
      )}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-xl text-navy">{value}</div>
    </div>
  );
}

function BigProgressCard({
  theme,
  icon,
  title,
  value,
  pct,
  footer,
}: {
  theme: "success" | "destructive";
  icon: React.ReactNode;
  title: string;
  value: string;
  pct: number;
  footer: string;
}) {
  const chip =
    theme === "success"
      ? "bg-success/15 text-success"
      : "bg-destructive/15 text-destructive";
  const bar = theme === "success" ? "bg-success" : "bg-destructive";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${chip}`}>
            {icon}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        </div>
        <span className="font-display text-3xl text-navy">{value}</span>
      </div>
      <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`${bar} h-full rounded-full transition-all duration-500`}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{footer}</p>
    </div>
  );
}
