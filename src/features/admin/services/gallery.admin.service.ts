import { supabase } from "@/integrations/supabase/client";
import { toServiceError } from "@/services/errors";
import type { GalleryImageRow } from "@/types/gallery";

const BUCKET = "gallery";
const SELECT = "id, image_url, created_at";

export type AdminGalleryListParams = {
  page?: number;
  pageSize?: number;
};

export type AdminGalleryList = {
  items: GalleryImageRow[];
  page: number;
  pageSize: number;
  total: number;
};

/** Extract the storage object path from a public URL of our gallery bucket. */
function extractStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

export const adminGalleryService = {
  async list(params: AdminGalleryListParams = {}): Promise<AdminGalleryList> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from("gallery_images")
      .select(SELECT, { count: "exact" })
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw toServiceError(error, "Could not load gallery");
    return {
      items: (data ?? []) as unknown as GalleryImageRow[],
      page,
      pageSize,
      total: count ?? 0,
    };
  },

  async uploadOne(file: File): Promise<GalleryImageRow> {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (upErr) throw toServiceError(upErr, "Upload failed");

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const image_url = pub.publicUrl;

    const { data, error } = await supabase
      .from("gallery_images")
      .insert({ image_url, storage_url: image_url } as any)
      .select(SELECT)
      .single();
    if (error) {
      // Cleanup the uploaded file if DB insert fails.
      await supabase.storage.from(BUCKET).remove([path]);
      throw toServiceError(error, "Could not save image");
    }
    return data as unknown as GalleryImageRow;
  },

  async uploadMany(files: File[]): Promise<GalleryImageRow[]> {
    const results: GalleryImageRow[] = [];
    for (const f of files) {
      results.push(await this.uploadOne(f));
    }
    return results;
  },

  async remove(id: string): Promise<{ id: string }> {
    const { data: row, error: getErr } = await supabase
      .from("gallery_images")
      .select("id, image_url")
      .eq("id", id)
      .maybeSingle();
    if (getErr) throw toServiceError(getErr, "Could not load image");

    const path = row?.image_url ? extractStoragePath(row.image_url) : null;
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]);
    }

    const { error } = await supabase.from("gallery_images").delete().eq("id", id);
    if (error) throw toServiceError(error, "Delete failed");
    return { id };
  },
};
