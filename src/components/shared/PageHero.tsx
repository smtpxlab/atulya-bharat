import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  bgImage?: string;
  align?: "center" | "left";
  className?: string;
  children?: ReactNode;
  /** tailwind height classes; defaults to a comfortable hero height */
  heightClassName?: string;
};

export const PageHero = ({
  eyebrow,
  title,
  subtitle,
  bgImage,
  align = "center",
  className,
  children,
  heightClassName,
}: Props) => {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden",
        bgImage ? "bg-navy text-white" : "bg-gradient-to-b from-primary/5 via-background to-background text-navy",
        heightClassName ?? (bgImage ? "min-h-[60vh] md:min-h-[70vh]" : "py-20 md:py-28"),
        "flex items-center",
        className
      )}
    >
      {bgImage && (
        <>
          <img
            src={bgImage}
            alt=""
            aria-hidden
            className="absolute inset-0 -z-10 h-full w-full object-cover"
            fetchPriority="high"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/40 to-black/70"
          />
        </>
      )}
      <div
        className={cn(
          "mx-auto w-full max-w-[1280px] px-6 md:px-8",
          align === "center" ? "text-center" : "text-left"
        )}
      >
        {eyebrow && (
          <p
            className={cn(
              "mb-4 text-xs font-semibold uppercase tracking-[0.2em]",
              bgImage ? "text-white/80" : "text-primary"
            )}
          >
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.1] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p
            className={cn(
              "mx-auto mt-5 max-w-[65ch] text-lg md:text-xl leading-[1.6]",
              bgImage ? "text-white/85" : "text-foreground/75",
              align === "left" && "mx-0"
            )}
          >
            {subtitle}
          </p>
        )}
        {children && (
          <div
            className={cn(
              "mt-8 flex flex-wrap gap-3",
              align === "center" && "justify-center"
            )}
          >
            {children}
          </div>
        )}
      </div>
    </section>
  );
};

export default PageHero;
