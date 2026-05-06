import { create } from "zustand";

/**
 * 토스 인앱 로그인 상태.
 *
 * - `idle`: 아직 시도 안 함
 * - `pending`: `appLogin()` 호출 중 (스플래시 노출)
 * - `loggedIn`: 인가코드 획득 성공
 * - `skipped`: 토스 환경 아님 (브라우저 dev 등) — 정상 진행
 * - `failed`: 호출 실패/사용자 거부 — 게스트로 진행
 */
export type AuthStatus =
  | "idle"
  | "pending"
  | "loggedIn"
  | "skipped"
  | "failed";

export type TossReferrer = "DEFAULT" | "SANDBOX";

interface AuthState {
  status: AuthStatus;
  authorizationCode: string | null;
  referrer: TossReferrer | null;
  /** 서버 교환 후 발급된 토스 numeric user key (스마트 발송 대상 식별) */
  tossUserKey: number | null;
  setPending: () => void;
  setLoggedIn: (input: {
    authorizationCode: string;
    referrer: TossReferrer;
  }) => void;
  setSkipped: () => void;
  setFailed: () => void;
  setTossUserKey: (key: number) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "idle",
  authorizationCode: null,
  referrer: null,
  tossUserKey: null,
  setPending: () => set({ status: "pending" }),
  setLoggedIn: ({ authorizationCode, referrer }) =>
    set({ status: "loggedIn", authorizationCode, referrer }),
  setSkipped: () => set({ status: "skipped" }),
  setFailed: () => set({ status: "failed" }),
  setTossUserKey: (key) => set({ tossUserKey: key }),
}));
