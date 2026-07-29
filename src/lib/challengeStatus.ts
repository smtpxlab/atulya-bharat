import { format } from "date-fns";

export const isChallengeExpired = (end_at: string | null | undefined): boolean =>
  !!end_at && new Date(end_at).getTime() < Date.now();

export const formatExpiryDate = (end_at: string | null | undefined): string =>
  end_at ? format(new Date(end_at), "d MMM yyyy") : "";
