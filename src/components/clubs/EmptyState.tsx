import { ReactNode } from "react";
import { Compass } from "lucide-react";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export const EmptyState = ({ icon, title, description, action, className = "" }: Props) => (
  <div
    className={
      "flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-card/50 px-6 py-14 text-center animate-fade-in " +
      className
    }
  >
    <div
      className="flex h-16 w-16 items-center justify-center rounded-2xl grad-warm text-primary-foreground shadow-card"
      aria-hidden
    >
      {icon ?? <Compass className="h-7 w-7" />}
    </div>
    <p className="font-display text-xl text-navy">{title}</p>
    {description && (
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    )}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
