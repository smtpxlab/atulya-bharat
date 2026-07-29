import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listPublishedBlogs } from "@/services/blog.service";
import { qk } from "@/lib/queryKeys";

export const BlogSection = () => {
  const { data, isLoading } = useQuery({
    queryKey: qk.blog.list(),
    queryFn: () => listPublishedBlogs(),
    staleTime: 60_000,
  });
  const posts = (data ?? []).slice(0, 4);

  if (!isLoading && posts.length === 0) return null;

  return (
    <section aria-labelledby="blog-title" className="abr-container py-16 sm:py-20">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Stories
          </p>
          <h2 id="blog-title" className="mt-2 text-navy">
            Our Blog
          </h2>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/blog">View All Blogs</Link>
        </Button>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? [0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[360px] rounded-2xl" />
            ))
          : posts.map((p) => (
              <Link
                key={p.id}
                to={`/blog/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-card transition hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  {p.cover_image_url ? (
                    <img
                      src={p.cover_image_url}
                      alt={p.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grad-warm h-full w-full opacity-80" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {p.published_at
                      ? format(new Date(p.published_at), "PPP")
                      : "Recently"}
                  </p>
                  <h3 className="mt-1.5 font-display text-lg leading-snug text-navy line-clamp-2">
                    {p.title}
                  </h3>
                  {p.excerpt && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {p.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
};

export default BlogSection;
