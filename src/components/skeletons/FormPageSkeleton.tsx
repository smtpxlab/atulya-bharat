import { Skeleton } from "@/components/ui/skeleton";

const FormPageSkeleton = () => (
  <main className="abr-container py-10" aria-hidden>
    <Skeleton className="h-9 w-1/3" />
    <Skeleton className="mt-2 h-4 w-1/2" />
    <div className="mt-8 max-w-2xl space-y-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-11 w-40 rounded-full" />
    </div>
  </main>
);

export default FormPageSkeleton;
