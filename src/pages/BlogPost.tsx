import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Clock, Copy, Facebook, MessageCircle, Twitter } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SafeHtml } from "@/components/editor/SafeHtml";
import { useBlogDetail, useBlogs } from "@/features/blog/hooks/useBlog";
import { readingTime } from "@/lib/utils";
import { absoluteUrl } from "@/lib/site";

const useReadingProgress = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop;
      const total = h.scrollHeight - h.clientHeight;
      setProgress(total > 0 ? Math.min(100, (scrolled / total) * 100) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return progress;
};

const ShareButtons = ({ url, title }: { url: string; title: string }) => {
  const t = encodeURIComponent(title);
  const u = encodeURIComponent(url);
  const items: { label: string; href?: string; onClick?: () => void; icon: React.ElementType }[] = [
    { label: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}`, icon: MessageCircle },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, icon: Facebook },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, icon: Twitter },
    {
      label: "Copy",
      onClick: () => {
        void navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      },
      icon: Copy,
    },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Share:
      </span>
      {items.map(({ label, href, onClick, icon: Icon }) =>
        href ? (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${label}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-navy transition hover:border-primary hover:text-primary"
          >
            <Icon className="h-4 w-4" />
          </a>
        ) : (
          <button
            key={label}
            onClick={onClick}
            aria-label="Copy link"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-navy transition hover:border-primary hover:text-primary"
          >
            <Icon className="h-4 w-4" />
          </button>
        )
      )}
    </div>
  );
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = useBlogDetail(slug);
  const { data: all = [] } = useBlogs();
  const progress = useReadingProgress();

  const related = post
    ? all
        .filter((p) => p.id !== post.id)
        .sort((a, b) => {
          const overlap = (x: typeof a) =>
            (x.tags ?? []).filter((t) => (post.tags ?? []).includes(t)).length;
          return overlap(b) - overlap(a);
        })
        .slice(0, 3)
    : [];

  const url = typeof window !== "undefined" ? window.location.href : "";

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1280px] px-6 md:px-8 py-12">
        <Skeleton className="h-[400px] w-full rounded-3xl" />
        <Skeleton className="mt-8 h-6 w-2/3" />
        <Skeleton className="mt-3 h-6 w-1/2" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-[1280px] px-6 md:px-8 py-20 text-center">
        <h1 className="font-display text-3xl text-navy">Post not found</h1>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/blog">Back to Blog</Link>
        </Button>
      </div>
    );
  }

  const minutes = readingTime(post.content_html ?? post.content_md);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.meta_description ?? post.excerpt ?? undefined,
    image: post.cover_image_url ?? undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at ?? post.published_at ?? undefined,
    author: post.author
      ? { "@type": "Person", name: post.author }
      : { "@type": "Organization", name: "Atulya Bharat Run" },
    publisher: {
      "@type": "Organization",
      name: "Atulya Bharat Run",
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };

  return (
    <>
      <SEO
        title={`${post.meta_title ?? post.title} | Atulya Bharat Run Blog`}
        description={post.meta_description ?? post.excerpt ?? undefined}
        image={post.cover_image_url ?? undefined}
        path={`/blog/${post.slug}`}
        type="article"
        keywords={post.meta_keywords?.length ? post.meta_keywords : undefined}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleLd)}</script>
      </Helmet>

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Blog", href: "/blog" },
          { name: post.title },
        ]}
      />

      {/* Reading progress */}
      <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-transparent">
        <div
          className="h-full bg-primary transition-[width] duration-100"
          style={{ width: `${progress}%` }}
          aria-hidden
        />
      </div>

      {/* Hero — image only, no overlay text */}
      {post.cover_image_url && (
        <div className="w-full bg-muted">
          <div className="mx-auto w-full max-w-[1280px] px-0 md:px-8 md:pt-8">
            <div className="relative aspect-[16/10] w-full overflow-hidden md:aspect-[21/9] md:rounded-3xl">
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="h-full w-full object-cover"
                fetchPriority="high"
              />
            </div>
          </div>
        </div>
      )}

      {/* Meta block + body */}
      <article className="mx-auto w-full max-w-3xl px-6 md:px-8 pt-8 md:pt-12 pb-12 md:pb-16">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Blog
        </Link>

        {post.tags && post.tags[0] && (
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {post.tags[0]}
          </p>
        )}

        <h1 className="mt-3 font-display text-3xl md:text-5xl font-bold leading-tight text-navy">
          {post.title}
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium text-navy">{post.author ?? "ABR Team"}</span>
          {post.published_at && (
            <>
              <span aria-hidden>·</span>
              <span>{format(new Date(post.published_at), "MMMM d, yyyy")}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {minutes} min read
          </span>
        </div>


        <div className="mt-10 prose prose-lg max-w-none prose-headings:font-display prose-headings:text-navy prose-headings:mt-10 prose-headings:mb-4 prose-p:leading-[1.8] prose-p:my-5 prose-img:rounded-2xl prose-img:my-8 prose-a:text-primary prose-li:my-1.5 prose-ul:my-5 prose-ol:my-5">
          {post.content_html ? (
            <SafeHtml html={post.content_html} />
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content_md ?? ""}</ReactMarkdown>
          )}
        </div>

        <div className="mt-12 border-t border-border pt-8 not-prose">
          <ShareButtons url={url} title={post.title} />
        </div>
      </article>

      {/* Related */}
      {related.length > 0 && (
        <section className="bg-muted/40 py-16 md:py-20">
          <div className="mx-auto w-full max-w-[1280px] px-6 md:px-8">
            <h2 className="mb-8 font-display text-2xl md:text-3xl font-bold text-navy">
              Related Articles
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.id}
                  to={`/blog/${p.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    {p.cover_image_url && (
                      <img
                        src={p.cover_image_url}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    {p.tags && p.tags[0] && (
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        {p.tags[0]}
                      </p>
                    )}
                    <h3 className="font-display text-base font-bold text-navy line-clamp-2">
                      {p.title}
                    </h3>
                    {p.excerpt && (
                      <p className="mt-2 text-sm text-foreground/70 line-clamp-2">{p.excerpt}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default BlogPost;
