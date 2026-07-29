import { Link } from "react-router-dom";
import { format } from "date-fns";
import { SEO } from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SafeHtml } from "@/components/editor/SafeHtml";
import { usePage } from "@/features/pages/hooks/usePage";

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const truncate = (s: string, n: number) =>
  s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;

interface LegalPageProps {
  slug: string;
}

const LegalPage = ({ slug }: LegalPageProps) => {
  const { data: page, isLoading, isError } = usePage(slug);

  if (isLoading) {
    return (
      <div className="abr-container py-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/3" />
        <div className="mt-8 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-9/12" />
        </div>
      </div>
    );
  }

  if (isError || !page) {
    return (
      <>
        <SEO title="Page not found | Atulya Bharat Run" />
        <div className="abr-container py-20 text-center">
          <h1 className="font-display text-3xl text-navy">Page not found</h1>
          <p className="mt-3 text-muted-foreground">
            The page you're looking for doesn't exist or is no longer available.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </>
    );
  }

  const description =
    truncate(stripHtml(page.content ?? ""), 160) || "Atulya Bharat Run";

  return (
    <>
      <SEO title={`${page.title} | Atulya Bharat Run`} description={description} />
      <article className="py-10 md:py-14">
        <div className="mx-auto w-full max-w-[960px] px-4 md:px-6">
          <header className="border-b border-border pb-6">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-navy">
              {page.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Last updated {format(new Date(page.updated_at), "MMMM d, yyyy")}
            </p>
          </header>

          <div className="mt-8">
            {page.content ? (
              <SafeHtml
                html={page.content}
                className="rich-content text-[1rem] md:text-[1.0625rem] leading-[1.8]"
              />
            ) : (
              <p className="text-muted-foreground">
                This page hasn't been written yet. Please check back soon.
              </p>
            )}
          </div>
        </div>
      </article>
    </>
  );
};

export default LegalPage;
