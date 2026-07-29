import { useQuery } from "@tanstack/react-query";
import { listPublishedBlogs, getPublishedBlogBySlug } from "@/services/blog.service";
import { qk } from "@/lib/queryKeys";

export function useBlogs(tag?: string) {
  return useQuery({
    queryKey: qk.blog.list(tag),
    queryFn: () => listPublishedBlogs(tag),
  });
}

export function useBlogDetail(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.blog.detail(slug) : ["blog", "detail", "none"],
    queryFn: () => getPublishedBlogBySlug(slug!),
    enabled: !!slug,
  });
}
