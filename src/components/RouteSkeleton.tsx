import { Skeleton } from "@/components/ui/skeleton";

export const RouteSkeleton = () => (
  <div className="abr-container space-y-6 py-16">
    <Skeleton className="h-10 w-1/3" />
    <Skeleton className="h-6 w-2/3" />
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[16/10] w-full rounded-2xl" />
      ))}
    </div>
  </div>
);
