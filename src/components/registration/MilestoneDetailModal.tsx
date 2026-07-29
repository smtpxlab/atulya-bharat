import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Lock, Play } from "lucide-react";
import { SafeHtml } from "@/components/SafeHtml";
import { PostcardModal } from "./PostcardModal";
import type { MilestoneRow } from "@/services/registration-detail.service";

type Props = {
  milestone: MilestoneRow | null;
  open: boolean;
  onClose: () => void;
  distanceLoggedKm: number;
};

export function MilestoneDetailModal({ milestone, open, onClose, distanceLoggedKm }: Props) {
  const [postcardOpen, setPostcardOpen] = useState(false);
  if (!milestone) return null;

  const unlocked = !!milestone.unlocked_at || distanceLoggedKm >= milestone.distance;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          className="flex max-h-[85vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden p-0"
        >
          {/* Sticky Header */}
          <div className="flex items-center gap-3 border-b border-border bg-card p-4">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
              {milestone.spot_image_url ? (
                <img
                  src={milestone.spot_image_url}
                  alt=""
                  className={`h-full w-full object-cover ${unlocked ? "" : "grayscale"}`}
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate font-display text-lg text-navy">
                {milestone.spot_name}
              </DialogTitle>
              <div className="mt-0.5 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                  {milestone.distance} KM
                </span>
                {unlocked ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 font-semibold text-success">
                    Unlocked
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                    Locked
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="relative aspect-[5/3] overflow-hidden rounded-xl bg-muted">
              {milestone.spot_image_url ? (
                <img
                  src={milestone.spot_image_url}
                  alt={milestone.spot_name}
                  className={`h-full w-full object-cover ${unlocked ? "" : "grayscale blur-sm"}`}
                />
              ) : (
                <div className="grid h-full place-items-center text-xs text-muted-foreground">
                  No image
                </div>
              )}
              {!unlocked && (
                <div className="absolute inset-0 grid place-items-center bg-black/40 text-center text-white">
                  <div>
                    <Lock className="mx-auto h-10 w-10" />
                    <p className="mt-2 text-sm font-medium">
                      Reach {milestone.distance} km to unlock
                    </p>
                  </div>
                </div>
              )}
            </div>

            {unlocked && milestone.description && (
              <div className="prose prose-sm mt-4 max-w-none text-foreground">
                <SafeHtml html={milestone.description} />
              </div>
            )}

            {unlocked && milestone.audio_url && (
              <div className="mt-4 rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Play className="h-3.5 w-3.5" /> Audio guide
                </div>
                <audio controls src={milestone.audio_url} className="w-full" />
              </div>
            )}

            {unlocked && milestone.postcard_url && (
              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                <img
                  src={milestone.postcard_url}
                  alt="Postcard"
                  className="block w-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-card p-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {unlocked && milestone.postcard_url && (
              <Button onClick={() => setPostcardOpen(true)}>
                <Download className="mr-2 h-4 w-4" /> Download Postcard
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PostcardModal
        open={postcardOpen}
        onClose={() => setPostcardOpen(false)}
        milestone={milestone}
      />
    </>
  );
}
