import { Skeleton } from "@/components/ui/skeleton";

const AdminContentSkeleton = () => (
  <div className="space-y-6" aria-hidden>
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-9 w-32 rounded-full" />
    </div>
    <Skeleton className="h-10 w-full max-w-md" />
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  </div>
);

export default AdminContentSkeleton;
