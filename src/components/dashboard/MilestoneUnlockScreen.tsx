import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play, Share2, X } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { SafeHtml } from "@/components/SafeHtml";

export type UnlockedMilestone = {
  id: string;
  sequence_no: number;
  title: string;
  landmark_name: string;
  description: string | null;
  image_url: string | null;
  audio_url: string | null;
  audio_duration: number | null;
  challenge_title: string;
  challenge_city: string;
  total_in_challenge: number;
  user_name: string;
};

type Props = {
  milestones: UnlockedMilestone[];
  open: boolean;
  onClose: () => void;
};

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export const MilestoneUnlockScreen = ({ milestones, open, onClose }: Props) => {
  const [idx, setIdx] = useState(0);
  const m = milestones[idx];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (open) setIdx(0);
  }, [open, milestones]);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setCurrent(0);
    setDuration(m?.audio_duration ?? 0);
    if (!open || !m?.audio_url) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    // Try autoplay
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [m?.id, open]);

  if (!open || !m) return null;

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const handleContinue = () => {
    if (idx + 1 < milestones.length) {
      setIdx(idx + 1);
    } else {
      onClose();
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#0a0f1e",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `abr-${m.landmark_name.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Image saved!");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate share image");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
      style={{ backgroundColor: "rgba(10, 15, 30, 0.95)" }}
      role="dialog"
      aria-modal="true"
    >
      {/* Animated rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute h-40 w-40 rounded-full border-2"
            style={{
              borderColor: i % 2 ? "hsl(var(--secondary))" : "hsl(var(--primary))",
              animation: `abr-ring 3s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.6}s infinite`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="relative z-10 w-full max-w-md animate-fade-in"
        style={{ animation: "abr-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
      >
        <div ref={cardRef} className="rounded-3xl bg-[#0a0f1e] p-6 text-white">
          <div className="flex justify-center">
            <span className="rounded-full border border-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Milestone {m.sequence_no} unlocked
            </span>
          </div>

          {m.image_url ? (
            <img
              src={m.image_url}
              alt={m.landmark_name}
              crossOrigin="anonymous"
              className="mt-5 h-60 w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="mt-5 flex h-60 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/30 font-display text-3xl">
              {m.sequence_no}
            </div>
          )}

          <div className="mt-5 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-secondary">{m.landmark_name}</p>
            <p className="text-xs text-white/60">{m.challenge_city}</p>
            <h2 className="mt-3 font-display text-[28px] leading-tight text-white">{m.title}</h2>
            {m.description && (
              <div className="prose prose-invert prose-sm mt-3 max-w-none text-sm leading-relaxed text-white/70 [&_*]:text-white/70">
                <SafeHtml html={m.description} />
              </div>
            )}
          </div>

          {/* Audio player */}
          {m.audio_url && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
              <button
                onClick={togglePlay}
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:scale-105"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
              </button>
              <div className="flex flex-1 items-center gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span
                    key={i}
                    className="block w-1 rounded-full bg-primary"
                    style={{
                      height: 12 + (i % 3) * 8,
                      animation: playing ? `abr-wave 0.9s ease-in-out ${i * 0.1}s infinite` : "none",
                      opacity: playing ? 1 : 0.5,
                    }}
                  />
                ))}
              </div>
              <div className="text-right text-[11px] tabular-nums text-white/70">
                {fmt(current)} / {fmt(duration)}
              </div>
              <audio
                ref={audioRef}
                src={m.audio_url}
                onTimeUpdate={(e) => {
                  const a = e.currentTarget;
                  setCurrent(a.currentTime);
                  setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
                }}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => setPlaying(false)}
                preload="metadata"
              />
            </div>
          )}

          {m.audio_url && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Position dots */}
          <div className="mt-5 flex justify-center gap-1.5">
            {Array.from({ length: m.total_in_challenge }).map((_, i) => {
              const seq = i + 1;
              const isCurrent = seq === m.sequence_no;
              const isPast = seq < m.sequence_no;
              return (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: isCurrent
                      ? "hsl(var(--primary))"
                      : isPast
                        ? "hsl(var(--secondary))"
                        : "rgba(255,255,255,0.2)",
                    transform: isCurrent ? "scale(1.4)" : "scale(1)",
                    transition: "transform 200ms",
                  }}
                />
              );
            })}
          </div>

          {/* Hidden share text inside the captured card */}
          <p className="mt-4 text-center text-[11px] text-white/50">
            {m.user_name} · Atulya Bharat Run
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            onClick={handleShare}
            variant="outline"
            className="flex-1 border-primary bg-transparent text-primary hover:bg-primary/10 hover:text-primary"
          >
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button onClick={handleContinue} className="flex-1">
            {idx + 1 < milestones.length ? `Next milestone (${idx + 2}/${milestones.length})` : "Continue Journey"}
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes abr-ring {
          0% { transform: scale(0.6); opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes abr-pop {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes abr-wave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.4); }
        }
      `}</style>
    </div>
  );
};
