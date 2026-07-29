import { supabase } from "@/integrations/supabase/client";
import { toServiceError } from "./errors";
import type { GalleryImageRow } from "@/types/gallery";

export const getGalleryImages = async (): Promise<GalleryImageRow[]> => {
  const { data, error } = await supabase
    .from("gallery_images")
    .select("id, image_url, created_at")
    .not("image_url", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw toServiceError(error, "Could not load gallery");
  return (data ?? []) as unknown as GalleryImageRow[];
};
