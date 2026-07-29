import { Skeleton } from "@/components/ui/skeleton";

const BlogPostSkeleton = () => (
  <main className="abr-container py-12" aria-hidden>
    <Skeleton className="h-6 w-24" />
    <Skeleton className="mt-6 h-12 w-3/4" />
    <Skeleton className="mt-3 h-4 w-1/3" />
    <Skeleton className="mt-8 aspect-[16/9] w-full rounded-2xl" />
    <div className="mt-8 space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  </main>
);

export default BlogPostSkeleton;
