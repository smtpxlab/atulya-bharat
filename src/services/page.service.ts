import { supabase } from "@/integrations/supabase/client";
import type { Page, PageDetail } from "@/types/page";
import { toServiceError } from "./errors";

const LIST_SELECT = "id,title,slug,status,created_at,updated_at";
const DETAIL_SELECT = "id,title,slug,content,status,created_by,created_at,updated_at";

export const listPublicPages = async (): Promise<Page[]> => {
  const { data, error } = await supabase
    .from("pages")
    .select(LIST_SELECT)
    .eq("status", "enabled")
    .order("title", { ascending: true });
  if (error) throw toServiceError(error, "Could not load pages");
  return (data ?? []) as unknown as Page[];
};

export const getPageBySlug = async (
  slug: string,
): Promise<PageDetail | null> => {
  const { data, error } = await supabase
    .from("pages")
    .select(DETAIL_SELECT)
    .eq("slug", slug)
    .eq("status", "enabled")
    .maybeSingle();
  if (error) throw toServiceError(error, "Could not load page");
  return (data as unknown as PageDetail) ?? null;
};
