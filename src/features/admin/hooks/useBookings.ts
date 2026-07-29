import { useQuery } from "@tanstack/react-query";
import {
  type BookingFilters,
  getBooking,
  getBookingsForUser,
  getChallengeStats,
  isStravaConnected,
  listBookings,
} from "../services/bookings.service";

export function useBookings(params: {
  filters: BookingFilters;
  page: number;
  pageSize: number;
}) {
  return useQuery({
    queryKey: ["admin", "bookings", params],
    queryFn: () => listBookings(params),
  });
}

export function useBooking(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "booking", id],
    queryFn: () => getBooking(id!),
    enabled: !!id,
  });
}

export function useUserBookings(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "bookings", "user", userId],
    queryFn: () => getBookingsForUser(userId!),
    enabled: !!userId,
  });
}

export function useChallengeBookingStats(challengeId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "bookings", "stats", challengeId],
    queryFn: () => getChallengeStats(challengeId!),
    enabled: !!challengeId,
  });
}

export function useStravaConnected(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "strava-connected", userId],
    queryFn: () => isStravaConnected(userId!),
    enabled: !!userId,
  });
}
