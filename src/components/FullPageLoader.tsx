import { Loader2 } from "lucide-react";

/**
 * Full-area loader used by route guards while auth is initializing.
 * Renders inside the current layout's outlet so site chrome stays mounted.
 */
const FullPageLoader = ({ label }: { label?: string }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-[60vh] w-full items-center justify-center"
  >
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      {label && <p className="text-sm">{label}</p>}
      <span className="sr-only">Loading…</span>
    </div>
  </div>
);

export default FullPageLoader;
