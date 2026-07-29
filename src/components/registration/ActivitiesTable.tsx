import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ActivityRow } from "@/services/registration-detail.service";

type Props = {
  activities: ActivityRow[];
};

const PAGE_SIZE = 10;

const formatDuration = (s: number | null) => {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
};

export function ActivitiesTable({ activities }: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(activities.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => activities.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [activities, safePage],
  );

  return (
    <section id="section-activities" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-navy">Activities</h2>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
          Total: {activities.length}
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No activities recorded in this challenge window yet. Sync Strava to import.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm md:text-base">
              <thead>
                <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Distance</th>
                  <th className="px-4 py-3 font-medium">Elapsed</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-navy">{format(new Date(a.activity_date), "d-MMM-yyyy")}</td>
                    <td className="px-4 py-3 font-display text-base text-navy">{a.distance_km.toFixed(2)} km</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDuration(a.moving_time_seconds)}</td>
                    <td className="px-4 py-3 text-foreground">{a.name ?? (a.source === "manual" ? "Manual entry" : "Strava activity")}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{a.sport_type ?? a.activity_type ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Showing {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, activities.length)} of {activities.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-medium text-navy transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <span className="font-semibold text-navy">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-medium text-navy transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
