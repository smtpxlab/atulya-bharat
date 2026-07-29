import { Skeleton } from "@/components/ui/skeleton";

const CheckoutSkeleton = () => (
  <main className="pb-12" aria-hidden>
    <section className="abr-container pt-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-10 w-1/3" />
      <Skeleton className="mt-2 h-4 w-1/2" />
    </section>
    <section className="abr-container mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <aside className="space-y-5">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </aside>
    </section>
  </main>
);

export default CheckoutSkeleton;
