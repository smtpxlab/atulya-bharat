// Source of truth:
//   • Marker position  ← admin-saved x_percent / y_percent only.
//   • Unlock status    ← distance_logged_km >= milestone.distance only.
// Never derive coordinates from distance and never depend on user_milestones
// rows for the visual unlock state — unlock jobs can fail.

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { stripHtml } from "@/lib/utils";
import type { MilestoneRow } from "@/services/registration-detail.service";

const MilestoneDetailModal = lazy(() =>
  import("./MilestoneDetailModal").then((m) => ({ default: m.MilestoneDetailModal })),
);

type Props = {
  routeImageUrl: string | null;
  milestones: MilestoneRow[];
  distanceLoggedKm: number;
  distanceTargetKm: number;
  pctComplete: number;
  challengeDistanceKm: number;
};

// Treat pins within this percent radius of each other as a "stack" and apply
// alternating vertical display offsets so they don't fully overlap.
const COLLISION_RADIUS_PCT = 3;
const STACK_OFFSET_PX = 14;

function useIsCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const handler = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return coarse;
}

export function RouteMapSection({
  routeImageUrl,
  milestones,
  distanceLoggedKm,
  distanceTargetKm,
  pctComplete,
  challengeDistanceKm,
}: Props) {
  const [selected, setSelected] = useState<MilestoneRow | null>(null);
  const isCoarse = useIsCoarsePointer();
  const pct = Math.max(0, Math.min(100, pctComplete));

  const isUnlocked = (m: MilestoneRow) => distanceLoggedKm >= m.distance;

  const placed = useMemo(
    () => milestones.filter((m) => m.x_percent != null && m.y_percent != null),
    [milestones],
  );

  const challengeComplete =
    challengeDistanceKm > 0 && distanceLoggedKm >= challengeDistanceKm;

  const finalMilestoneId = useMemo(() => {
    if (placed.length === 0) return null;
    return placed.reduce((a, b) => (b.distance >= a.distance ? b : a)).id;
  }, [placed]);

  const activeId = useMemo(() => {
    const unlocked = placed.filter(isUnlocked);
    if (unlocked.length === 0) return null;
    return unlocked.reduce((a, b) => (b.distance >= a.distance ? b : a)).id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, distanceLoggedKm]);

  // Group overlapping pins → apply alternating Y offsets without mutating coords.
  const stackOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    const grouped = new Set<string>();
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i];
      if (grouped.has(a.id)) continue;
      const cluster: MilestoneRow[] = [a];
      for (let j = i + 1; j < placed.length; j++) {
        const b = placed[j];
        if (grouped.has(b.id)) continue;
        const dx = (a.x_percent ?? 0) - (b.x_percent ?? 0);
        const dy = (a.y_percent ?? 0) - (b.y_percent ?? 0);
        if (Math.hypot(dx, dy) <= COLLISION_RADIUS_PCT) cluster.push(b);
      }
      if (cluster.length > 1) {
        cluster
          .sort((p, q) => p.distance - q.distance)
          .forEach((m, idx) => {
            grouped.add(m.id);
            // -14, +14, -28, +28 …
            const sign = idx % 2 === 0 ? -1 : 1;
            const mag = Math.ceil((idx + 1) / 2) * STACK_OFFSET_PX;
            offsets.set(m.id, sign * mag);
          });
      } else {
        grouped.add(a.id);
      }
    }
    return offsets;
  }, [placed]);

  // Current / Next / Remaining summary.
  const summary = useMemo(() => {
    if (milestones.length === 0) return null;
    const sorted = [...milestones].sort((a, b) => a.distance - b.distance);
    const current = [...sorted].reverse().find((m) => distanceLoggedKm >= m.distance) ?? null;
    const next = sorted.find((m) => distanceLoggedKm < m.distance) ?? null;
    const remaining = next ? Math.max(0, next.distance - distanceLoggedKm) : 0;
    return { current, next, remaining };
  }, [milestones, distanceLoggedKm]);

  const showEmptyState = !!routeImageUrl && placed.length === 0;

  return (
    <section id="section-route" className="space-y-4">
      <h2 className="font-display text-2xl text-navy">Your Progress Map</h2>
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-card">
        {routeImageUrl ? (
          <img src={routeImageUrl} alt="Challenge route" className="block w-full" loading="lazy" />
        ) : (
          <div className="grid h-48 place-items-center text-sm text-muted-foreground">
            Route map not uploaded yet
          </div>
        )}

        {showEmptyState && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="rounded-full bg-background/90 px-4 py-2 text-xs font-medium text-muted-foreground shadow">
              No milestone locations configured yet.
            </div>
          </div>
        )}

        <TooltipProvider delayDuration={150}>
          {placed.map((m) => {
            const unlocked = challengeComplete || isUnlocked(m);
            const isFinal = m.id === finalMilestoneId;
            const goldPulse = challengeComplete && isFinal;
            const greenPulse = !challengeComplete && m.id === activeId;
            const color = unlocked
              ? "fill-success text-success"
              : "fill-muted-foreground/70 text-muted-foreground";
            const yOffset = stackOffsets.get(m.id) ?? 0;

            const trigger = (
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`${m.spot_name} ${m.distance} km ${
                    unlocked ? "unlocked" : "locked"
                  }`}
                  className="relative grid place-items-center focus:outline-none"
                >
                  {(goldPulse || greenPulse) && (
                    <span
                      className={`absolute inline-flex h-8 w-8 animate-ping rounded-full ${
                        goldPulse ? "bg-amber-400/70" : "bg-success/60"
                      }`}
                    />
                  )}
                  <MapPin
                    className={`relative h-7 w-7 drop-shadow ${
                      goldPulse ? "fill-amber-400 text-amber-500" : color
                    }`}
                    strokeWidth={1.5}
                  />
                </button>
              </PopoverTrigger>
            );

            return (
              <div
                key={m.id}
                className="absolute z-10 -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${m.x_percent}%`,
                  top: `${m.y_percent}%`,
                  transform: `translate(-50%, calc(-100% + ${yOffset}px))`,
                }}
              >
                <Popover>
                  {isCoarse ? (
                    trigger
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <div className="font-semibold">{m.spot_name}</div>
                        <div className="text-muted-foreground">
                          {m.distance} KM · {unlocked ? "Unlocked" : "Locked"}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <PopoverContent side="top" className="w-64 p-0">
                    <div className="overflow-hidden rounded-md">
                      {m.spot_image_url ? (
                        <img
                          src={m.spot_image_url}
                          alt={m.spot_name}
                          loading="lazy"
                          className={`block aspect-[5/3] w-full object-cover ${
                            unlocked ? "" : "grayscale"
                          }`}
                        />
                      ) : (
                        <div className="grid aspect-[5/3] place-items-center bg-muted text-xs text-muted-foreground">
                          No image
                        </div>
                      )}
                      <div className="space-y-2 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="truncate font-display text-base text-navy">
                            {m.spot_name}
                          </h4>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {m.distance} KM
                          </span>
                        </div>
                        {m.description && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {stripHtml(m.description)}
                          </p>
                        )}
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            unlocked
                              ? "bg-success/15 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {unlocked ? "Unlocked" : "Locked"}
                        </span>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => setSelected(m)}
                        >
                          View Milestone
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            );
          })}
        </TooltipProvider>
      </div>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Current Milestone
            </p>
            <p className="mt-1 truncate font-display text-base text-navy">
              {summary.current ? summary.current.spot_name : "Not started"}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.current ? `${summary.current.distance} KM` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Next Milestone
            </p>
            <p className="mt-1 truncate font-display text-base text-navy">
              {summary.next ? summary.next.spot_name : "All milestones reached"}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.next ? `${summary.next.distance} KM` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Remaining
            </p>
            <p className="mt-1 font-display text-base text-navy">
              {summary.next ? `${summary.remaining.toFixed(1)} KM` : "0.0 KM"}
            </p>
            <p className="text-xs text-muted-foreground">
              to {summary.next ? summary.next.spot_name : "finish"}
            </p>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-navy">
          {distanceLoggedKm.toFixed(1)} km
        </span>{" "}
        of {distanceTargetKm} km · {pct.toFixed(1)}%
      </p>

      {selected && (
        <Suspense fallback={null}>
          <MilestoneDetailModal
            milestone={selected}
            open={!!selected}
            onClose={() => setSelected(null)}
            distanceLoggedKm={distanceLoggedKm}
          />
        </Suspense>
      )}
    </section>
  );
}
