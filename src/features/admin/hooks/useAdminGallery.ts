import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminGalleryService,
  type AdminGalleryListParams,
} from "../services/gallery.admin.service";
import { adminQk } from "./useAdminDashboard";
import { qk } from "@/lib/queryKeys";

export function useAdminGallery(params: AdminGalleryListParams) {
  return useQuery({
    queryKey: adminQk.gallery.list(params as Record<string, unknown>),
    queryFn: () => adminGalleryService.list(params),
    placeholderData: (prev) => prev,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: adminQk.gallery.all });
  qc.invalidateQueries({ queryKey: qk.gallery.all });
}

export function useUploadGalleryImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => adminGalleryService.uploadMany(files),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteGalleryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminGalleryService.remove(id),
    onSuccess: () => invalidateAll(qc),
  });
}
