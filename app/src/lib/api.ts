import { getAnonymousKey } from "@apps-in-toss/web-framework";
import type {
  Environment,
  SkinType,
} from "./recommendation";

/**
 * 백엔드 베이스 URL.
 *
 * - dev (Vite): `VITE_API_URL` 환경변수 우선, 없으면 `http://localhost:8787` (wrangler dev 기본)
 * - prod: `VITE_API_URL`을 빌드 시 주입 (또는 [.env.local](../../.env.local) 작성)
 *
 * 앱 빌드 전에 반드시 prod URL을 설정해야 토스 미니앱 안에서 동작해요.
 * 미설정이라도 클라 자체는 정상 동작 — 서버 등록만 실패함.
 */
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:8787";

const DEV_USER_KEY_STORAGE = "sunalarm.devUserKey.v1";

/**
 * 사용자 식별 키 조회.
 * - 토스 인앱: `getAnonymousKey()` (디바이스·앱별 고유)
 * - dev/브라우저: localStorage에 안정적인 가짜 키 생성
 */
export async function getUserKey(): Promise<string | null> {
  if (import.meta.env.DEV) {
    try {
      let dev = window.localStorage.getItem(DEV_USER_KEY_STORAGE);
      if (!dev) {
        dev = "dev-" + Math.random().toString(36).slice(2, 12);
        window.localStorage.setItem(DEV_USER_KEY_STORAGE, dev);
      }
      return dev;
    } catch {
      return null;
    }
  }
  try {
    const res = await getAnonymousKey();
    if (!res || res === "ERROR") return null;
    return res.hash;
  } catch (err) {
    console.warn("[api] getAnonymousKey failed", err);
    return null;
  }
}

export interface RegisterUserPayload {
  userKey: string;
  skinType: SkinType;
  environment: Environment;
  startMinute: number;
  endMinute: number;
  slotMinutes: number[];
}

/**
 * 사용자 등록/업데이트. 실패해도 throw 하지 않고 결과 객체로 반환.
 * 호출부는 `void registerUser(...)` 처럼 fire-and-forget 가능.
 */
export async function registerUser(
  payload: RegisterUserPayload,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[api] registerUser http", res.status, text);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    if (import.meta.env.DEV) {
      console.debug("[api] registerUser ok", payload.userKey);
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[api] registerUser failed", msg);
    return { ok: false, error: msg };
  }
}

/** opt-out — 서버에서도 삭제. */
export async function unregisterUser(
  userKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/users`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userKey }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * 토스 로그인 인가코드 + referrer를 서버에 보내서 numeric tossUserKey 획득·저장.
 * 푸시 알림(스마트 발송) 활성화 전제.
 *
 * 호출 전 `registerUser`로 사용자가 서버에 등록돼 있어야 해요.
 */
export async function loginWithToss(input: {
  userKey: string;
  authorizationCode: string;
  referrer: "DEFAULT" | "SANDBOX";
}): Promise<{ ok: boolean; tossUserKey?: number; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      tossUserKey?: number;
      error?: string;
      step?: string;
    } | null;
    if (!res.ok || !data?.ok) {
      const errorMsg = data?.error
        ? `${data.step ?? "?"}: ${data.error}`
        : `HTTP ${res.status}`;
      console.warn("[api] loginWithToss failed", errorMsg);
      return { ok: false, error: errorMsg };
    }
    if (import.meta.env.DEV) {
      console.debug("[api] loginWithToss ok", data.tossUserKey);
    }
    return { ok: true, tossUserKey: data.tossUserKey };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[api] loginWithToss threw", msg);
    return { ok: false, error: msg };
  }
}
