import { create } from "zustand";
import { readJSON, writeJSON } from "../lib/storage";

export type Screen = "welcome" | "onboarding" | "home" | "applyResult";

const WELCOME_KEY = "sunalarm.welcomeAck.v1";

interface AppState {
  screen: Screen;
  /** "발랐어요" 직후 결과 화면에서 다룰 슬롯 인덱스 */
  resultSlotIndex: number;
  /** 인트로(welcome)를 한 번이라도 보고 진행한 적이 있는지 */
  welcomeAcknowledged: boolean;
  navigate: (s: Screen) => void;
  goToResult: (slotIndex: number) => void;
  acknowledgeWelcome: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  screen: "welcome",
  resultSlotIndex: -1,
  welcomeAcknowledged: readJSON<boolean>(WELCOME_KEY, false),
  navigate: (s) => set({ screen: s }),
  goToResult: (slotIndex) =>
    set({ screen: "applyResult", resultSlotIndex: slotIndex }),
  acknowledgeWelcome: () => {
    writeJSON(WELCOME_KEY, true);
    set({ welcomeAcknowledged: true });
  },
}));
