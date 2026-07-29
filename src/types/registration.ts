export type RegistrationStatus = "active" | "completed" | "cancelled";

export type Registration = {
  id: string;
  user_id: string;
  challenge_id: string;
  ticket_id: string | null;
  activity_mode: string;
  target_days: number;
  total_km_logged: number;
  status: RegistrationStatus;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  user_id: string;
  registration_id: string | null;
  challenge_id: string | null;
  activity_date: string;
  activity_type: string;
  distance_km: number;
  source: string | null;
  notes: string | null;
};

export type UserMilestone = {
  id: string;
  user_id: string;
  milestone_id: string;
  registration_id: string | null;
  unlocked_at: string;
};
