import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/shared/PageHero";
import { useGallery } from "@/features/gallery/hooks/useGallery";

const Gallery = () => {
  const { data, isLoading } = useGallery();
  const images = useMemo(() => data ?? [], [data]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const openLightbox = (idx: number) => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);
  const nav = (delta: number) => {
    if (lightboxIdx === null) return;
    setLightboxIdx((lightboxIdx + delta + images.length) % images.length);
  };

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nav(1);
      if (e.key === "ArrowLeft") nav(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIdx, images.length]);

  return (
    <>
      <SEO
        title="Gallery | Atulya Bharat Run"
        description="Moments from our virtual running and cycling events across India — communities, challenges, and unforgettable experiences."
      />

      <PageHero
        eyebrow="Gallery"
        title="Moments That Move Us"
        subtitle="Explore unforgettable experiences from our challenges, communities and events."
        heightClassName="pt-16 pb-6 md:pt-20 md:pb-8"
      />

      <section className="mx-auto w-full max-w-[1280px] px-6 md:px-8 pt-2 md:pt-4 pb-12 md:pb-16">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-16 text-center">
            <p className="text-lg text-muted-foreground">No images yet — check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => openLightbox(i)}
                className="group relative aspect-square block w-full overflow-hidden rounded-2xl shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <img
                  src={img.image_url}
                  alt="Atulya Bharat Run moment"
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition group-hover:opacity-100"
                />
              </button>
            ))}
          </div>
        )}
      </section>


      {/* CTA */}
      <section className="pb-20">
        <div className="mx-auto w-full max-w-[1280px] px-6 md:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-10 md:p-14 text-center text-primary-foreground shadow-lg">
            <h2 className="font-display text-3xl md:text-4xl font-bold">
              Join the Next Adventure
            </h2>
            <p className="mx-auto mt-3 max-w-[55ch] text-base md:text-lg opacity-90">
              Be part of the next story. Pick a challenge and run, walk or ride your way through India.
            </p>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="mt-7 rounded-full bg-white text-primary hover:bg-white/90"
            >
              <Link to="/challenges">Explore Challenges</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightboxIdx !== null && images[lightboxIdx] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nav(-1);
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nav(1);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full max-w-5xl flex-col items-center"
          >
            <img
              src={images[lightboxIdx].image_url}
              alt="Gallery image"
              className="max-h-[85vh] w-auto rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Gallery;
