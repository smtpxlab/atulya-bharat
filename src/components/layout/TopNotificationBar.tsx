import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { usePublicNotifications } from "@/features/notifications/hooks/usePublicNotifications";

const DISMISS_KEY = "abr-top-bar-dismissed";

export const TopNotificationBar = () => {
  const { data } = usePublicNotifications();
  const items = data ?? [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    }
  }, []);

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [items.length, paused]);

  if (dismissed || items.length === 0) return null;

  const current = items[index % items.length];

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="Site notifications"
      className="relative w-full overflow-hidden bg-primary text-primary-foreground"
      style={{ height: 40 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="abr-container flex h-full items-center justify-center gap-2 pr-8 text-center text-xs sm:text-sm">
        <Megaphone className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <p
          key={current.id}
          className="truncate animate-[fade-in_0.4s_ease-out]"
        >
          <span className="font-semibold">{current.title}</span>
          <span className="mx-2 opacity-60">·</span>
          <span className="opacity-95">{current.message}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notifications"
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-primary-foreground/80 transition hover:bg-white/10 hover:text-primary-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default TopNotificationBar;
