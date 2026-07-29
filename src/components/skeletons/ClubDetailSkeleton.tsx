import { Skeleton } from "@/components/ui/skeleton";

const ClubDetailSkeleton = () => (
  <main aria-hidden>
    <Skeleton className="h-[280px] w-full md:h-[360px]" />
    <div className="abr-container space-y-6 py-10">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-5 w-1/3" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  </main>
);

export default ClubDetailSkeleton;
