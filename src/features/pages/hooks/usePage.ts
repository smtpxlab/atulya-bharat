import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { getPageBySlug, listPublicPages } from "@/services/page.service";

export const usePage = (slug?: string) =>
  useQuery({
    queryKey: qk.pages.detail(slug ?? ""),
    queryFn: () => getPageBySlug(slug as string),
    enabled: !!slug,
    staleTime: 60_000,
  });

export const usePublicPages = () =>
  useQuery({
    queryKey: qk.pages.list(),
    queryFn: listPublicPages,
    staleTime: 60_000,
  });
