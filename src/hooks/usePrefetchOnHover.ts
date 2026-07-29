import { useCallback } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

type PrefetchArgs<T> = {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  staleTime?: number;
};

/**
 * Returns handlers that prefetch data on hover/focus.
 * Idempotent — React Query dedupes if the query is already cached & fresh.
 *
 *   const prefetch = usePrefetchOnHover({ queryKey, queryFn });
 *   <Link {...prefetch} to={...} />
 */
export function usePrefetchOnHover<T>({ queryKey, queryFn, staleTime = 60_000 }: PrefetchArgs<T>) {
  const qc = useQueryClient();
  const run = useCallback(() => {
    void qc.prefetchQuery({ queryKey, queryFn, staleTime });
  }, [qc, queryKey, queryFn, staleTime]);

  return {
    onMouseEnter: run,
    onFocus: run,
    onTouchStart: run,
  } as const;
}
