import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Play, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { MilestoneDetailModal } from "@/components/registration/MilestoneDetailModal";
import type { MilestoneRow as RegMilestoneRow } from "@/services/registration-detail.service";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeId: string | null;
  challengeTitle: string;
  userId: string;
};

type MilestoneRow = {
  id: string;
  sequence_no: number;
  landmark_name: string;
  title: string;
  unlock_at_km: number;
  image_url: string | null;
  audio_url: string | null;
  description: string | null;
  unlocked_at: string | null;
};

export const MilestoneLibraryDrawer = ({
  open,
  onOpenChange,
  challengeId,
  challengeTitle,
  userId,
}: Props) => {
  const [rows, setRows] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<RegMilestoneRow | null>(null);

  useEffect(() => {
    if (!open || !challengeId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [milestonesRes, mediaRes, unlocksRes] = await Promise.all([
        supabase
          .from("challenge_milestones")
          .select("id, sort_order, spot_name, distance, description, spot_image_url, audio_url")
          .eq("challenge_id", challengeId)
          .order("distance", { ascending: true }),
        supabase
          .from("milestone_media")
          .select("milestone_id, media_type, storage_url, is_primary")
          .eq("is_primary", true),
        supabase
          .from("user_milestones")
          .select("milestone_id, unlocked_at")
          .eq("user_id", userId),
      ]);
      if (cancelled) return;

      const mediaByMilestone = new Map<string, { image?: string; audio?: string }>();
      for (const md of mediaRes.data ?? []) {
        const cur = mediaByMilestone.get(md.milestone_id) ?? {};
        if (md.media_type === "image" && !cur.image) cur.image = md.storage_url;
        if (md.media_type === "audio" && !cur.audio) cur.audio = md.storage_url;
        mediaByMilestone.set(md.milestone_id, cur);
      }
      const unlockedMap = new Map<string, string>();
      for (const u of unlocksRes.data ?? []) {
        unlockedMap.set(u.milestone_id, u.unlocked_at);
      }

      const built: MilestoneRow[] = ((milestonesRes.data ?? []) as any[]).map((m, i) => ({
        id: m.id,
        sequence_no: i + 1,
        landmark_name: m.spot_name,
        title: m.spot_name,
        unlock_at_km: Number(m.distance),
        image_url: m.spot_image_url ?? mediaByMilestone.get(m.id)?.image ?? null,
        audio_url: m.audio_url ?? mediaByMilestone.get(m.id)?.audio ?? null,
        description: m.description ?? null,
        unlocked_at: unlockedMap.get(m.id) ?? null,
      }));
      setRows(built);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, challengeId, userId]);

  const togglePlay = (m: MilestoneRow) => {
    if (!m.audio_url) return;
    if (playingId === m.id && audio) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    if (audio) audio.pause();
    const a = new Audio(m.audio_url);
    a.play().then(() => {
      setAudio(a);
      setPlayingId(m.id);
      a.onended = () => setPlayingId(null);
    });
  };

  const openDetail = (m: MilestoneRow) => {
    setSelected({
      id: m.id,
      challenge_id: challengeId ?? "",
      sort_order: m.sequence_no,
      spot_name: m.landmark_name,
      distance: m.unlock_at_km,
      description: m.description,
      spot_image_url: m.image_url,
      audio_url: m.audio_url,
      unlocked_at: m.unlocked_at,
      postcard_url: m.image_url,
    } as RegMilestoneRow);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-display text-navy">Milestones — {challengeTitle}</SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones for this challenge yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((m) => {
                const unlocked = !!m.unlocked_at;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => openDetail(m)}
                    className="overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <div className="relative aspect-square bg-muted">
                      {m.image_url ? (
                        <img
                          src={m.image_url}
                          alt={m.landmark_name}
                          className="h-full w-full object-cover"
                          style={!unlocked ? { filter: "blur(8px)" } : undefined}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 font-display text-3xl text-navy">
                          {m.sequence_no}
                        </div>
                      )}

                      {!unlocked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white">
                          <Lock className="h-7 w-7" />
                          <p className="mt-2 text-xs font-semibold">Unlock at {m.unlock_at_km} km</p>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">
                        Milestone {m.sequence_no} · {m.unlock_at_km} KM
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-navy">{m.landmark_name}</p>
                      {unlocked ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Unlocked {format(new Date(m.unlocked_at!), "d MMM yyyy")}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted-foreground">Locked</p>
                      )}

                      {unlocked && (
                        <div className="mt-2 flex gap-1.5">
                          {m.audio_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 flex-1 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePlay(m);
                              }}
                            >
                              <Play className="mr-1 h-3 w-3" />
                              {playingId === m.id ? "Pause" : "Play"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Share2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>

      <MilestoneDetailModal
        milestone={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        distanceLoggedKm={selected?.unlocked_at ? selected.distance : 0}
      />
    </Sheet>
  );
};
