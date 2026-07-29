import { useState } from "react";
import { Lock, CheckCircle2 } from "lucide-react";
import { MilestoneDetailModal } from "./MilestoneDetailModal";
import type { MilestoneRow } from "@/services/registration-detail.service";

type Props = {
  milestones: MilestoneRow[];
  distanceLoggedKm: number;
};

export function MilestonesSection({ milestones, distanceLoggedKm }: Props) {
  const [selected, setSelected] = useState<MilestoneRow | null>(null);

  return (
    <section id="section-milestones" className="space-y-4">
      <h2 className="font-display text-2xl text-navy">Your Progress</h2>
      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No milestones configured for this challenge yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {milestones.map((m) => {
            const unlocked = !!m.unlocked_at;
            const hasAudio = unlocked && !!m.audio_url;
            return (
              <div
                key={m.id}
                className="group overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-primary/40 hover:shadow"
              >
                <button
                  type="button"
                  onClick={() => setSelected(m)}
                  className="block w-full text-left"
                >
                  <div className="relative aspect-[5/3] overflow-hidden bg-muted">
                    {m.spot_image_url ? (
                      <img
                        src={m.spot_image_url}
                        alt={m.spot_name}
                        className={`h-full w-full object-cover transition group-hover:scale-105 ${unlocked ? "" : "grayscale"}`}
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-muted-foreground">No image</div>
                    )}
                    {!unlocked && (
                      <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-sm">
                        <Lock className="h-8 w-8 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-display text-base text-navy">{m.spot_name}</h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {m.distance} KM
                      </span>
                    </div>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs">
                      {unlocked ? (
                        <span className="text-success"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Unlocked</span>
                      ) : (
                        <span className="text-muted-foreground"><Lock className="mr-1 inline h-3.5 w-3.5" />Locked</span>
                      )}
                    </p>
                  </div>
                </button>
                {hasAudio && (
                  <div
                    className="border-t border-border px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <audio
                      controls
                      preload="none"
                      src={m.audio_url ?? undefined}
                      className="h-8 w-full"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <MilestoneDetailModal
        milestone={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        distanceLoggedKm={distanceLoggedKm}
      />
    </section>
  );
}
