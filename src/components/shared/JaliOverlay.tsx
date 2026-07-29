import { cn } from "@/lib/utils";

export const JaliOverlay = ({
  className,
  opacity = 0.08,
}: {
  className?: string;
  opacity?: number;
}) => (
  <div
    aria-hidden
    className={cn(
      "pointer-events-none absolute inset-0 bg-pattern-jali",
      className,
    )}
    style={{ opacity }}
  />
);

export default JaliOverlay;
