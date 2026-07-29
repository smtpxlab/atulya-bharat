import { useQuery } from "@tanstack/react-query";
import { adminDashboardService } from "../services/dashboard.admin";

export const adminQk = {
  dashboard: ["admin", "dashboard"] as const,
  challenges: {
    all: ["admin", "challenges"] as const,
    list: (params: Record<string, unknown>) =>
      ["admin", "challenges", "list", params] as const,
    detail: (id: string) => ["admin", "challenges", "detail", id] as const,
  },
  clubs: {
    all: ["admin", "clubs"] as const,
    list: (params: Record<string, unknown>) =>
      ["admin", "clubs", "list", params] as const,
    detail: (id: string) => ["admin", "clubs", "detail", id] as const,
    members: (id: string) => ["admin", "clubs", "members", id] as const,
    reports: ["admin", "clubs", "reports"] as const,
    reportSummary: ["admin", "clubs", "reports", "summary"] as const,
    reportMembers: ["admin", "clubs", "reports", "members"] as const,
  },
  milestones: {
    all: ["admin", "milestones"] as const,
    list: (params: Record<string, unknown>) =>
      ["admin", "milestones", "list", params] as const,
    detail: (id: string) => ["admin", "milestones", "detail", id] as const,
  },
  blog: {
    all: ["admin", "blog"] as const,
    list: (params: Record<string, unknown>) =>
      ["admin", "blog", "list", params] as const,
    detail: (id: string) => ["admin", "blog", "detail", id] as const,
  },
  gallery: {
    all: ["admin", "gallery"] as const,
    list: (params: Record<string, unknown>) =>
      ["admin", "gallery", "list", params] as const,
  },
};

export function useAdminDashboard() {
  return useQuery({
    queryKey: adminQk.dashboard,
    queryFn: () => adminDashboardService.getSummary(),
    staleTime: 30_000,
  });
}
