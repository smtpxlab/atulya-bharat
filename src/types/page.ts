export type PageStatus = "enabled" | "disabled";

export interface Page {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageDetail extends Page {
  content: string;
}
