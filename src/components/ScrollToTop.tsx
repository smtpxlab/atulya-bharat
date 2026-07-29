import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll to top on route change. Preserves hash-anchor jumps.
 * Disables browser's automatic scroll restoration so forward nav always
 * starts at the top.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const prev =
      typeof window !== "undefined" && "scrollRestoration" in window.history
        ? window.history.scrollRestoration
        : undefined;
    if (prev !== undefined) {
      window.history.scrollRestoration = "manual";
    }
    return () => {
      if (prev !== undefined) {
        window.history.scrollRestoration = prev;
      }
    };
  }, []);

  useEffect(() => {
    if (hash) {
      const id = hash.startsWith("#") ? hash.slice(1) : hash;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
