import { supabase } from "@/integrations/supabase/client";

const DEFAULT_BUCKET = "challenge-assets";

/**
 * Upload an inline rich-text image and return its public URL.
 * Files are stored under `rich-text/<folder>/<uuid>.<ext>` in the
 * shared `challenge-assets` bucket (public read, admin write).
 */
export async function uploadRichTextImage(
  file: File,
  folder = "misc",
  bucket: string = DEFAULT_BUCKET,
): Promise<string> {
  if (!file) throw new Error("No file provided");
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `rich-text/${folder}/${id}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
