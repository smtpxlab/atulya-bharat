import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Search, ArrowRight, Clock } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHero } from "@/components/shared/PageHero";
import { useBlogs } from "@/features/blog/hooks/useBlog";
import { readingTime, stripHtml } from "@/lib/utils";

const PAGE_SIZE = 9;

const Blog = () => {
  const { data: posts = [], isLoading } = useBlogs();
  const [activeTag, setActiveTag] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    posts.forEach((p) => (p.tags ?? []).forEach((t) => s.add(t)));
    return ["All", ...Array.from(s).sort()];
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      const tagOk = activeTag === "All" || (p.tags ?? []).includes(activeTag);
      if (!tagOk) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.excerpt ?? "").toLowerCase().includes(q)
      );
    });
  }, [posts, activeTag, query]);

  const visible = filtered.slice(0, visibleCount);

  useEffect(() => setVisibleCount(PAGE_SIZE), [activeTag, query]);

  return (
    <>
      <SEO
        title="Blog | Atulya Bharat Run"
        description="Stories, tips and inspiration from fitness journeys, travel adventures and the Atulya Bharat Run community."
      />

      <PageHero
        eyebrow="The ABR Journal"
        title="Stories, Tips & Inspiration"
        subtitle="Discover fitness journeys, travel stories, challenge updates and expert insights from across India."
      />

      <section className="mx-auto w-full max-w-[1280px] px-6 md:px-8 py-12 md:py-16">
        {/* Search + filter — no container card */}
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles..."
              className="h-11 rounded-full border-border bg-background pl-10"
              aria-label="Search articles"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  activeTag === tag
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-navy hover:border-primary hover:text-primary"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-96 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <p className="text-lg text-muted-foreground">No posts match your search.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((p, idx) => (
                <Link
                  key={p.id}
                  to={`/blog/${p.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    {p.cover_image_url ? (
                      <img
                        src={p.cover_image_url}
                        alt={p.title}
                        loading={idx < 3 ? "eager" : "lazy"}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5" />
                    )}
                    {idx === 0 && activeTag === "All" && !query && (
                      <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground shadow-sm">
                        Featured
                      </span>
                    )}
                    {p.tags && p.tags[0] && !(idx === 0 && activeTag === "All" && !query) && (
                      <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground shadow-sm">
                        {p.tags[0]}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="font-display text-lg font-bold text-navy line-clamp-2">
                      {p.title}
                    </h3>
                    {p.excerpt && (
                      <p className="mt-2 text-sm text-foreground/70 leading-relaxed line-clamp-2">
                        {stripHtml(p.excerpt)}
                      </p>
                    )}
                    <div className="mt-auto pt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-navy">{p.author ?? "ABR Team"}</span>
                      {p.published_at && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{format(new Date(p.published_at), "MMM d, yyyy")}</span>
                        </>
                      )}
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {readingTime(p.content_html ?? p.content_md)} min
                      </span>
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      Read More <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {visibleCount < filtered.length && (
              <div className="mt-10 text-center">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full"
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                >
                  Load more articles
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
};

export default Blog;
