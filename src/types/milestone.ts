export type Milestone = {
  id: string;
  challenge_id: string;
  spot_name: string;
  distance: number;
  spot_image_url: string | null;
  audio_url: string | null;
  description: string;
  status: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type MilestoneFormValues = {
  challenge_id: string;
  spot_name: string;
  distance: number;
  spot_image_url: string | null;
  audio_url: string | null;
  description: string;
  status: boolean;
};

export type MilestoneListItem = Milestone & {
  challenge: { id: string; name: string } | null;
};
