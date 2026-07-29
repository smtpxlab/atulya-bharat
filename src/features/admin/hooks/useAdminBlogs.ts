import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminBlogsService,
  type AdminBlogListParams,
} from "../services/blog.admin.service";
import type { AdminBlogInput, AdminBlogUpdate } from "@/schemas/blog.schema";
import { adminQk } from "./useAdminDashboard";
import { qk } from "@/lib/queryKeys";

export function useAdminBlogs(params: AdminBlogListParams) {
  return useQuery({
    queryKey: adminQk.blog.list(params as Record<string, unknown>),
    queryFn: () => adminBlogsService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useAdminBlog(id: string | undefined) {
  return useQuery({
    queryKey: id ? adminQk.blog.detail(id) : ["admin", "blog", "detail", "none"],
    queryFn: () => adminBlogsService.get(id!),
    enabled: !!id,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: adminQk.blog.all });
  qc.invalidateQueries({ queryKey: qk.blog.all });
}

export function useCreateBlog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminBlogInput) => adminBlogsService.create(input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateBlog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminBlogUpdate) => adminBlogsService.update(id, input),
    onSuccess: (data) => {
      invalidateAll(qc);
      qc.setQueryData(adminQk.blog.detail(id), data);
    },
  });
}

export function useDeleteBlog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminBlogsService.remove(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function usePublishBlog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminBlogsService.publish(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUnpublishBlog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminBlogsService.unpublish(id),
    onSuccess: () => invalidateAll(qc),
  });
}
