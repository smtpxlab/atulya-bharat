import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  linkLabel?: string;
  linkTo?: string;
  align?: "left" | "center";
  className?: string;
};

export const SectionHeading = ({
  eyebrow,
  title,
  subtitle,
  linkLabel,
  linkTo,
  align = "left",
  className,
}: Props) => (
  <div
    className={cn(
      "flex flex-wrap items-end justify-between gap-4",
      align === "center" && "flex-col items-center text-center",
      className,
    )}
  >
    <div className={align === "center" ? "max-w-2xl" : "max-w-2xl"}>
      {eyebrow && (
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 font-display text-3xl md:text-4xl text-accent">
        {title}
      </h2>
      <span
        aria-hidden
        className={cn(
          "mt-3 block h-[2px] w-20 bg-gold animate-underline",
          align === "center" && "mx-auto",
        )}
      />
      {subtitle && (
        <p className="mt-4 text-base text-muted-foreground">{subtitle}</p>
      )}
    </div>

    {linkLabel && linkTo && (
      <Link
        to={linkTo}
        className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent hover:text-primary transition-colors"
      >
        {linkLabel} →
      </Link>
    )}
  </div>
);

export default SectionHeading;
