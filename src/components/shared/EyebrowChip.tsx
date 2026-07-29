import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  pulse?: boolean;
};

export const EyebrowChip = ({ children, className, pulse }: Props) => (
  <span
    className={cn(
      "inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold",
      className,
    )}
  >
    <span
      aria-hidden
      className={cn(
        "h-1.5 w-1.5 rounded-full bg-gold",
        pulse && "animate-gold-pulse",
      )}
    />
    {children}
  </span>
);

export default EyebrowChip;
