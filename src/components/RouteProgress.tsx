import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import NProgress from "nprogress";

NProgress.configure({
  showSpinner: false,
  trickleSpeed: 120,
  minimum: 0.12,
  easing: "ease",
  speed: 320,
});

/**
 * Top progress bar that starts on every route change and finishes once the
 * new route is mounted (or after a short safety timeout for lazy chunks).
 */
const RouteProgress = () => {
  const { pathname, search } = useLocation();
  const firstRender = useRef(true);
  const doneTimer = useRef<number | null>(null);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    NProgress.start();
    if (doneTimer.current) window.clearTimeout(doneTimer.current);
    // Finish on next paint when route is rendered; safety fallback at 1.2s.
    const raf = requestAnimationFrame(() => {
      NProgress.done();
    });
    doneTimer.current = window.setTimeout(() => NProgress.done(), 1200);
    return () => {
      cancelAnimationFrame(raf);
      if (doneTimer.current) window.clearTimeout(doneTimer.current);
    };
  }, [pathname, search]);

  return null;
};

export default RouteProgress;
