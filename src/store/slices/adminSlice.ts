import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ChallengeStatusFilter = "all" | "draft" | "published";
export type ClubStatusFilter = "all" | "pending" | "approved" | "rejected";
export type ClubVisibilityFilter = "all" | "public" | "hidden";
export type BlogStatusFilter = "all" | "draft" | "published";
export type PageStatusFilter = "all" | "enabled" | "disabled";

type ListFilter<TStatus> = {
  q: string;
  status: TStatus;
  page: number;
};

type MilestoneFilter = {
  q: string;
  challengeId: string; // "all" or uuid
  page: number;
};

type PagesFilter = {
  q: string;
  status: PageStatusFilter;
  page: number;
  pageSize: number;
};

type AdminState = {
  challenges: ListFilter<ChallengeStatusFilter>;
  clubs: ListFilter<ClubStatusFilter>;
  milestones: MilestoneFilter;
  blog: ListFilter<BlogStatusFilter>;
  pages: PagesFilter;
};

const initialState: AdminState = {
  challenges: { q: "", status: "all", page: 1 },
  clubs: { q: "", status: "all", page: 1 },
  milestones: { q: "", challengeId: "all", page: 1 },
  blog: { q: "", status: "all", page: 1 },
  pages: { q: "", status: "all", page: 1, pageSize: 10 },
};

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    setChallengeFilter(
      state,
      action: PayloadAction<Partial<ListFilter<ChallengeStatusFilter>>>,
    ) {
      Object.assign(state.challenges, action.payload);
      if (action.payload.q !== undefined || action.payload.status !== undefined) {
        state.challenges.page = action.payload.page ?? 1;
      }
    },
    setClubFilter(
      state,
      action: PayloadAction<Partial<ListFilter<ClubStatusFilter>>>,
    ) {
      Object.assign(state.clubs, action.payload);
      if (action.payload.q !== undefined || action.payload.status !== undefined) {
        state.clubs.page = action.payload.page ?? 1;
      }
    },
    setMilestoneFilter(state, action: PayloadAction<Partial<MilestoneFilter>>) {
      Object.assign(state.milestones, action.payload);
      if (
        action.payload.q !== undefined ||
        action.payload.challengeId !== undefined
      ) {
        state.milestones.page = action.payload.page ?? 1;
      }
    },
    setBlogFilter(
      state,
      action: PayloadAction<Partial<ListFilter<BlogStatusFilter>>>,
    ) {
      Object.assign(state.blog, action.payload);
      if (action.payload.q !== undefined || action.payload.status !== undefined) {
        state.blog.page = action.payload.page ?? 1;
      }
    },
    setPageFilter(state, action: PayloadAction<Partial<PagesFilter>>) {
      Object.assign(state.pages, action.payload);
      if (
        action.payload.q !== undefined ||
        action.payload.status !== undefined ||
        action.payload.pageSize !== undefined
      ) {
        state.pages.page = action.payload.page ?? 1;
      }
    },
  },
});

export const {
  setChallengeFilter,
  setClubFilter,
  setMilestoneFilter,
  setBlogFilter,
  setPageFilter,
} = adminSlice.actions;
export const adminReducer = adminSlice.reducer;
