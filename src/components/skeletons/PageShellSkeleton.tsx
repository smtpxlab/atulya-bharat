import { Skeleton } from "@/components/ui/skeleton";

/**
 * Neutral page-shape placeholder used as the SiteLayout Suspense fallback.
 * Keeps Navbar/Footer mounted; only the <main> area shows shape.
 */
const PageShellSkeleton = () => (
  <div className="abr-container space-y-6 py-10" aria-hidden>
    <Skeleton className="h-8 w-1/3" />
    <Skeleton className="h-4 w-2/3" />
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[16/10] w-full rounded-2xl" />
      ))}
    </div>
  </div>
);

export default PageShellSkeleton;
