import { cn } from "@/lib/utils";

type Props = {
  value: string;
  label: string;
  variant?: "navy" | "cream";
  accent?: "saffron" | "gold";
};

export const StatTile = ({
  value,
  label,
  variant = "navy",
  accent = "saffron",
}: Props) => {
  const onNavy = variant === "navy";
  return (
    <div className="group space-y-2">
      <div className="font-display text-3xl md:text-4xl font-bold text-gold transition-transform duration-300 group-hover:scale-105">
        {value}
      </div>
      <div
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.2em]",
          onNavy ? "text-white/60" : "text-muted-foreground",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "h-1 w-8",
          accent === "saffron" ? "bg-primary" : "bg-gold",
        )}
      />
    </div>
  );
};

export default StatTile;
