import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, MoodEntry, PartnerReminder } from "@/types";

interface AppState {
  user: User | null;
  token: string | null;
  moodEntries: MoodEntry[];
  partnerReminder: PartnerReminder | null;
  onboardingStep: number;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  addMoodEntry: (entry: MoodEntry) => void;
  setPartnerReminder: (reminder: PartnerReminder | null) => void;
  setOnboardingStep: (step: number) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      moodEntries: [],
      partnerReminder: null,
      onboardingStep: 0,

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      addMoodEntry: (entry) =>
        set((state) => ({ moodEntries: [entry, ...state.moodEntries] })),
      setPartnerReminder: (reminder) => set({ partnerReminder: reminder }),
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      logout: () => set({ user: null, token: null, moodEntries: [], onboardingStep: 0 }),
    }),
    { name: "postnatal-wellness-store" }
  )
);
