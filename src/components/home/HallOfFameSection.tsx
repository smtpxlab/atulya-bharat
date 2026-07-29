import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Facebook, ImageIcon } from "lucide-react";
import { getGalleryImages } from "@/services/gallery.service";
import type { GalleryImageRow } from "@/types/gallery";

export const HallOfFameSection = () => {
  const [images, setImages] = useState<GalleryImageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getGalleryImages();
        if (!cancelled) setImages(rows.slice(0, 6));
      } catch {
        if (!cancelled) setImages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="hof-title" className="bg-muted/40 section-y">
      <div className="abr-container">
        <div className="grid gap-10 lg:grid-cols-10 lg:items-center">
          {/* Gallery 70% */}
          <div className="order-2 lg:order-1 lg:col-span-7">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loading
                ? [0, 1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
                  ))
                : images.length === 0
                  ? (
                    <div className="col-span-full rounded-3xl border border-dashed border-border bg-card p-10 text-center">
                      <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground" />
                      <p className="mt-3 font-display text-lg text-navy">
                        Gallery photos coming soon
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Event highlights will appear here.
                      </p>
                    </div>
                  )
                  : images.map((img) => (
                      <Link
                        key={img.id}
                        to="/gallery"
                        className="group relative block overflow-hidden rounded-2xl bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
                      >
                        <img
                          src={img.image_url ?? ""}
                          alt="Community gallery"
                          loading="lazy"
                          className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </Link>
                    ))}
            </div>
            {!loading && images.length > 0 && (
              <div className="mt-6 flex justify-center lg:justify-start">
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/gallery">View more</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Content 30% */}
          <div className="order-1 lg:order-2 lg:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Community
            </p>
            <h2 id="hof-title" className="mt-2 text-navy">
              Join Our Fitness Community
            </h2>
            <p className="prose-narrow mt-4 text-base text-muted-foreground">
              Connect with runners and cyclists, celebrate milestones, and stay
              inspired with fellow fitness enthusiasts.
            </p>
            <div className="mt-6">
              <Button asChild size="lg" className="rounded-full">
                <a
                  href="https://www.facebook.com/groups/abrglobal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Facebook className="h-4 w-4" /> Join on Facebook
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
