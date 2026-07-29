import { Skeleton } from "@/components/ui/skeleton";

export const ClubCardSkeleton = () => (
  <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
    <Skeleton className="aspect-[16/10] w-full rounded-none" />
    <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  </div>
);
