import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SafeHtml } from "@/components/editor/SafeHtml";
import { usePublicTestimonials } from "@/features/testimonials/hooks/useTestimonials";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { stripHtml } from "@/lib/utils";
import type { Testimonial } from "@/types/testimonial";

const PREVIEW_THRESHOLD = 180;

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TestimonialsSection() {
  const { data, isLoading } = usePublicTestimonials();
  const [emblaRef, embla] = useEmblaCarousel({
    align: "start",
    loop: true,
    skipSnaps: false,
  });
  const items = data ?? [];
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<Testimonial | null>(null);
  const scrollPrev = useRef(() => embla?.scrollPrev());
  const scrollNext = useRef(() => embla?.scrollNext());
  scrollPrev.current = () => embla?.scrollPrev();
  scrollNext.current = () => embla?.scrollNext();

  useEffect(() => {
    if (!embla || items.length <= 1 || paused) return;
    const id = window.setInterval(() => embla.scrollNext(), 6000);
    return () => window.clearInterval(id);
  }, [embla, items.length, paused]);

  if (!isLoading && items.length === 0) return null;

  return (
    <section
      className="abr-container py-16"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >

      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Voices from the run
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            What our community says
          </h2>
        </div>
        {items.length > 1 && (
          <div className="hidden sm:flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scrollPrev.current()}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scrollNext.current()}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-4">
          {(isLoading ? Array.from({ length: 3 }) : items).map((t, i) => {
            const data = t as typeof items[number] | undefined;
            return (
              <div
                key={data?.id ?? i}
                className="flex-[0_0_100%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] pl-4"
              >
                <article className="h-full flex flex-col rounded-2xl border bg-card p-6 shadow-sm">
                  <Quote className="h-8 w-8 text-primary/40" aria-hidden />
                  <div className="mt-3 flex-1">
                    {data ? (
                      <>
                        <SafeHtml
                          html={data.description}
                          className="rich-content text-sm text-muted-foreground line-clamp-3"
                        />
                        {stripHtml(data.description).length > PREVIEW_THRESHOLD && (
                          <button
                            type="button"
                            onClick={() => setSelected(data)}
                            className="mt-2 text-xs font-semibold text-primary hover:underline"
                          >
                            View more
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="h-16 animate-pulse rounded bg-muted" />
                    )}
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    {data?.image_url ? (
                      <img
                        src={data.image_url}
                        alt={data.author_name}
                        className="h-11 w-11 rounded-full object-cover border"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold border">
                        {data ? initialsOf(data.author_name) : ""}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {data?.author_name ?? "—"}
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {selected?.image_url ? (
                <img
                  src={selected.image_url}
                  alt={selected.author_name}
                  className="h-12 w-12 rounded-full border object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-primary/10 text-sm font-semibold text-primary">
                  {selected ? initialsOf(selected.author_name) : ""}
                </div>
              )}
              <DialogTitle className="text-left text-base">
                {selected?.author_name}
              </DialogTitle>
            </div>
          </DialogHeader>
          <Quote className="h-6 w-6 text-primary/40" aria-hidden />
          {selected && (
            <SafeHtml
              html={selected.description}
              className="rich-content max-h-[60vh] overflow-y-auto text-sm leading-relaxed text-foreground"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default TestimonialsSection;
