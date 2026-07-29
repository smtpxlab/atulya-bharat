import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { getGalleryImages } from "@/services/gallery.service";

export function useGallery() {
  return useQuery({
    queryKey: qk.gallery.public(),
    queryFn: getGalleryImages,
  });
}
