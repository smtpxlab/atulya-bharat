import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Avatar } from "@/components/Avatar";
import { usePublicTestimonials } from "@/features/testimonials/hooks/useTestimonials";
import { stripHtml } from "@/lib/utils";
import { Quote } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SafeHtml } from "@/components/editor/SafeHtml";
import type { Testimonial } from "@/types/testimonial";

const AUTOPLAY_MS = 5000;
const PREVIEW_THRESHOLD = 240;

export const TestimonialsCarousel = () => {
  const { data: items = [], isLoading } = usePublicTestimonials();
  const [api, setApi] = useState<CarouselApi>();
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<Testimonial | null>(null);

  useEffect(() => {
    if (!api || paused || items.length <= 1) return;
    const id = setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
      else api.scrollTo(0);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [api, paused, items.length]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-3xl bg-muted"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Testimonials coming soon.
      </p>
    );
  }

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Carousel
        setApi={setApi}
        opts={{ align: "start", loop: true }}
        className="w-full"
      >
        <CarouselContent className="-ml-4">
          {items.map((t) => (
            <CarouselItem
              key={t.id}
              className="pl-4 md:basis-1/2 lg:basis-1/3"
            >
              <article className="flex h-full flex-col rounded-3xl border border-border bg-card p-6 shadow-sm">
                <Quote className="h-6 w-6 text-primary/60" aria-hidden />
                <p className="mt-3 line-clamp-6 text-sm leading-relaxed text-foreground">
                  {stripHtml(t.description)}
                </p>
                {stripHtml(t.description).length > PREVIEW_THRESHOLD && (
                  <button
                    type="button"
                    onClick={() => setSelected(t)}
                    className="mt-2 self-start text-xs font-semibold text-primary hover:underline"
                  >
                    View more
                  </button>
                )}
                <div className="mt-5 flex items-center gap-3">
                  <Avatar url={t.image_url} name={t.author_name} size={40} />
                  <p className="text-sm font-semibold text-navy">
                    {t.author_name}
                  </p>
                </div>
              </article>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="mt-4 flex items-center justify-end gap-2">
          <CarouselPrevious
            className="static translate-y-0"
            aria-label="Previous testimonial"
          />
          <CarouselNext
            className="static translate-y-0"
            aria-label="Next testimonial"
          />
        </div>
      </Carousel>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Avatar url={selected?.image_url ?? null} name={selected?.author_name ?? ""} size={48} />
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
    </div>
  );
};

export default TestimonialsCarousel;
