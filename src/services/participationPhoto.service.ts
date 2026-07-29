import { supabase } from "@/integrations/supabase/client";

const BUCKET = "participation-photos";

function objectPath(userId: string, registrationId: string, ext: string) {
  // Keep one object per registration to enforce "single version".
  return `${userId}/${registrationId}.${ext}`;
}

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** Upload (or replace) the athlete's participation photo for this registration. */
export async function uploadParticipationPhoto(params: {
  userId: string;
  registrationId: string;
  file: File;
}): Promise<string> {
  const { userId, registrationId, file } = params;
  const ext = extFromMime(file.type);

  // Remove any previously-saved variants under other extensions so we never
  // accumulate multiple versions.
  const others = ["jpg", "png", "webp"].filter((e) => e !== ext);
  await supabase.storage
    .from(BUCKET)
    .remove(others.map((e) => objectPath(userId, registrationId, e)))
    .catch(() => undefined);

  const path = objectPath(userId, registrationId, ext);
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
  });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Append a cache-buster so the new image shows up immediately.
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updErr } = await supabase
    .from("registrations")
    .update({ participation_photo_url: url })
    .eq("id", registrationId);
  if (updErr) throw updErr;

  return url;
}

/** Remove the participation photo (storage object + column) for this registration. */
export async function removeParticipationPhoto(params: {
  userId: string;
  registrationId: string;
}): Promise<void> {
  const { userId, registrationId } = params;
  const paths = ["jpg", "png", "webp"].map((e) => objectPath(userId, registrationId, e));
  await supabase.storage.from(BUCKET).remove(paths).catch(() => undefined);
  const { error } = await supabase
    .from("registrations")
    .update({ participation_photo_url: null })
    .eq("id", registrationId);
  if (error) throw error;
}
