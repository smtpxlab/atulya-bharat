import { Skeleton } from "@/components/ui/skeleton";

const ChallengeDetailSkeleton = () => (
  <main aria-hidden>
    <Skeleton className="h-[360px] w-full md:h-[420px]" />
    <div className="abr-container space-y-6 py-10">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  </main>
);

export default ChallengeDetailSkeleton;
