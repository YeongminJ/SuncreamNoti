import { create } from "zustand";
import { readJSON, writeJSON } from "../lib/storage";
import type { Environment, SkinType } from "../lib/recommendation";

const STORAGE_KEY = "sunalarm.profile.v2";

export interface Profile {
  skinType: SkinType;
  environment: Environment;
  /** KST 분 단위 슬롯 시각 배열 (사용자가 직접 선택). */
  slotMinutes: number[];
  completedAt: number;
}

interface ProfileState {
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  reset: () => void;
  /** 오늘의 권장 슬롯 시각 (분). 프로필 미설정 시 빈 배열. */
  slotsForToday: () => number[];
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: readJSON<Profile | null>(STORAGE_KEY, null),
  setProfile: (p) => {
    writeJSON(STORAGE_KEY, p);
    set({ profile: p });
  },
  reset: () => {
    writeJSON(STORAGE_KEY, null);
    set({ profile: null });
  },
  slotsForToday: () => get().profile?.slotMinutes ?? [],
}));
