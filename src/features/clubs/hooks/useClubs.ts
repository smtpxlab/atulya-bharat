import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { qk } from "@/lib/queryKeys";
import {
  AlreadyMemberError,
  createClub,
  getClubBySlug,
  joinClub,
  leaveClub,
  listClubs,
  listClubMembers,
  listMyClubMemberships,
  listMyClubs,
} from "@/services/club.service";
import type { UserClubInput } from "@/schemas/club.schema";
import { toast } from "sonner";

export function useClubs() {
  return useQuery({ queryKey: qk.clubs.list(), queryFn: listClubs, staleTime: 30_000 });
}

export function useClubBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.clubs.bySlug(slug) : ["clubs", "bySlug", "none"],
    queryFn: () => getClubBySlug(slug!),
    enabled: !!slug,
  });
}

export function useClubMembers(clubId: string | undefined) {
  return useQuery({
    queryKey: clubId ? qk.clubs.members(clubId) : ["clubs", "members", "none"],
    queryFn: () => listClubMembers(clubId!),
    enabled: !!clubId,
  });
}

export function useMyClubs(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? qk.clubs.myClubs(userId) : ["clubs", "myClubs", "none"],
    queryFn: () => listMyClubs(userId!),
    enabled: !!userId,
  });
}

export function useMyClubMemberships(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? qk.clubs.memberships(userId) : ["clubs", "memberships", "none"],
    queryFn: () => listMyClubMemberships(userId!),
    enabled: !!userId,
  });
}

export function useCreateClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, userId }: { input: UserClubInput; userId: string }) =>
      createClub(input, userId),
    onSuccess: (_d, { userId }) => {
      qc.invalidateQueries({ queryKey: qk.clubs.all });
      qc.invalidateQueries({ queryKey: qk.clubs.memberships(userId) });
      qc.invalidateQueries({ queryKey: qk.clubs.myClubs(userId) });
    },
  });
}

export function useJoinClub() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  return useMutation({
    mutationFn: ({ clubId, userId }: { clubId: string; userId: string }) =>
      joinClub(clubId, userId),
    onSuccess: (_d, { userId, clubId }) => {
      toast.success("Successfully joined the club.");
      qc.invalidateQueries({ queryKey: qk.clubs.all });
      qc.invalidateQueries({ queryKey: qk.clubs.myClubs(userId) });
      qc.invalidateQueries({ queryKey: qk.clubs.memberships(userId) });
      qc.invalidateQueries({ queryKey: qk.clubs.members(clubId) });
    },
    onError: (e: Error) => {
      if (e instanceof AlreadyMemberError || (e as any)?.code === "ALREADY_MEMBER") {
        toast.error("You are already a member of this club.");
      } else if ((e as any)?.code === "auth_required") {
        toast.error("Please sign in to continue.");
        navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      } else {
        toast.error(e.message);
      }
    },
  });
}

export function useLeaveClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clubId, userId }: { clubId: string; userId: string }) =>
      leaveClub(clubId, userId),
    onSuccess: (_d, { userId, clubId }) => {
      toast.success("You have left the club.");
      qc.invalidateQueries({ queryKey: qk.clubs.all });
      qc.invalidateQueries({ queryKey: qk.clubs.myClubs(userId) });
      qc.invalidateQueries({ queryKey: qk.clubs.memberships(userId) });
      qc.invalidateQueries({ queryKey: qk.clubs.members(clubId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
