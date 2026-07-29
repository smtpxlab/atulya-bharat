import { supabase } from "@/integrations/supabase/client";

export type AdminDashboardSummary = {
  usersCount: number;
  challengesCount: number;
  clubsCount: number;
  registrationsCount: number;
};

const headCount = (table: "profiles" | "challenges" | "clubs" | "registrations") =>
  supabase.from(table).select("id", { count: "exact", head: true });

export const adminDashboardService = {
  async getSummary(): Promise<AdminDashboardSummary> {
    const [users, challenges, clubs, registrations] = await Promise.all([
      headCount("profiles"),
      headCount("challenges"),
      headCount("clubs"),
      headCount("registrations"),
    ]);
    return {
      usersCount: users.count ?? 0,
      challengesCount: challenges.count ?? 0,
      clubsCount: clubs.count ?? 0,
      registrationsCount: registrations.count ?? 0,
    };
  },
};
