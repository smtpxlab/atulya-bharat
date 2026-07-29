import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Stat = {
  label: string;
  value: number;
  Icon: LucideIcon;
  suffix?: string;
  decimals?: number;
};

const Counter = ({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) => {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setN(value);
      return;
    }
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      // ease-out
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);

  return (
    <span>
      {n.toFixed(decimals)}
      {suffix}
    </span>
  );
};

type Props = { stats: Stat[]; loading: boolean };

export const StatsGrid = ({ stats, loading }: Props) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {stats.map(({ label, value, Icon, suffix, decimals }, i) => (
      <motion.div
        key={label}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: i * 0.06, ease: "easeOut" }}
        className="card-elevated p-5"
      >
        <div className="flex items-center justify-between">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-4 font-display text-3xl text-navy md:text-4xl">
          {loading ? <Skeleton className="h-9 w-20" /> : <Counter value={value} decimals={decimals} suffix={suffix} />}
        </div>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </motion.div>
    ))}
  </div>
);
