export type GalleryImage = {
  id: string;
  storage_url: string;
  caption: string | null;
  event_name: string | null;
  challenge_id: string | null;
  sort_order: number;
  uploaded_at: string;
};

/** Simple gallery row used by the new admin + public flow. */
export type GalleryImageRow = {
  id: string;
  image_url: string;
  created_at: string;
};
