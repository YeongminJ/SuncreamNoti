import { create } from "zustand";
import { readJSON, writeJSON } from "../lib/storage";
import {
  recommendedSlotMinutes,
  type Environment,
  type SkinType,
} from "../lib/recommendation";

const STORAGE_KEY = "sunalarm.profile.v1";

export interface Profile {
  skinType: SkinType;
  environment: Environment;
  startMinute: number; // 0~1439
  endMinute: number;
  completedAt: number; // epoch ms
}

interface ProfileState {
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  reset: () => void;
  /** 오늘의 권장 슬롯 시각(분). 프로필 미설정 시 빈 배열. */
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
  slotsForToday: () => {
    const p = get().profile;
    if (p == null) return [];
    return recommendedSlotMinutes({
      skinType: p.skinType,
      environment: p.environment,
      startMinute: p.startMinute,
      endMinute: p.endMinute,
    });
  },
}));
