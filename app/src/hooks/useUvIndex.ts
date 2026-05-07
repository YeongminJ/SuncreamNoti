import { Accuracy, getCurrentLocation } from "@apps-in-toss/web-framework";
import { useCallback, useEffect, useState } from "react";

/**
 * 자외선 지수(UV index) 조회 hook.
 *
 * 동작:
 * - 기본 좌표는 **서울**. 위치 권한 요청 없이 즉시 표시.
 * - 사용자가 "내 위치로 보기"를 클릭하면 그때 토스 SDK `getCurrentLocation` 호출 → 권한 모달 노출.
 * - 응답은 Open-Meteo 공개 API에서 직접 fetch (서버 경유 X, key 없음, CORS OK).
 * - localStorage에 (lat,lon → 소수 1자리) 키로 1시간 캐시.
 *
 * 부가 정보 용도라 실패해도 silently skip — 별도 에러 토스트 없음.
 */

const DEFAULT_LAT = 37.5665;
const DEFAULT_LON = 126.978;
const SEOUL_LABEL = "서울 기준";
const USER_LABEL = "내 위치";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간
const CACHE_KEY_PREFIX = "sunalarm.uv.v1";

export type UvLevel = "약함" | "보통" | "강함" | "매우 강함" | "위험";

export function levelFromUv(uv: number): UvLevel {
  if (uv < 3) return "약함";
  if (uv < 6) return "보통";
  if (uv < 8) return "강함";
  if (uv < 11) return "매우 강함";
  return "위험";
}

interface CacheEntry {
  uv: number;
  ts: number;
}

function cacheKey(lat: number, lon: number): string {
  return `${CACHE_KEY_PREFIX}.${lat.toFixed(1)}.${lon.toFixed(1)}`;
}

function readCache(lat: number, lon: number): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(lat, lon));
    if (!raw) return null;
    const c = JSON.parse(raw) as CacheEntry;
    if (typeof c.uv !== "number" || typeof c.ts !== "number") return null;
    if (Date.now() - c.ts > CACHE_TTL_MS) return null;
    return c;
  } catch {
    return null;
  }
}

function writeCache(lat: number, lon: number, uv: number): void {
  try {
    window.localStorage.setItem(
      cacheKey(lat, lon),
      JSON.stringify({ uv, ts: Date.now() }),
    );
  } catch {
    // ignore
  }
}

async function fetchUvFromOpenMeteo(
  lat: number,
  lon: number,
): Promise<number | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}` +
    `&longitude=${lon}` +
    `&current=uv_index` +
    `&timezone=Asia%2FSeoul`;
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;
    const json = (await res.json()) as { current?: { uv_index?: number } };
    const v = json.current?.uv_index;
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

export interface UvState {
  uv: number | null;
  level: UvLevel | null;
  locationLabel: string;
  loading: boolean;
  /** 사용자가 한 번이라도 본인 위치로 갱신했는지 */
  isUserLocation: boolean;
  /** 클릭 시 권한 요청 + 좌표 갱신. 거부되거나 실패하면 서울 유지. */
  requestUserLocation: () => Promise<void>;
}

export function useUvIndex(): UvState {
  const [coords, setCoords] = useState<{
    lat: number;
    lon: number;
    isUser: boolean;
  }>({ lat: DEFAULT_LAT, lon: DEFAULT_LON, isUser: false });
  const [uv, setUv] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = readCache(coords.lat, coords.lon);
    if (cached) {
      setUv(cached.uv);
      return;
    }
    let alive = true;
    setLoading(true);
    void fetchUvFromOpenMeteo(coords.lat, coords.lon).then((v) => {
      if (!alive) return;
      if (v != null) {
        setUv(v);
        writeCache(coords.lat, coords.lon, v);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [coords.lat, coords.lon]);

  const requestUserLocation = useCallback(async () => {
    if (typeof getCurrentLocation !== "function") return;
    // 옵티미스틱: 사용자가 클릭한 순간 라벨/버튼 즉시 갱신.
    // 좌표 응답이 늦거나 부분 실패해도 사용자 의사 (내 위치)는 존중.
    setCoords((prev) => ({ ...prev, isUser: true }));
    try {
      const result = await getCurrentLocation({
        accuracy: Accuracy.Balanced,
      });
      const lat = result?.coords?.latitude;
      const lon = result?.coords?.longitude;
      if (typeof lat === "number" && typeof lon === "number") {
        setCoords({ lat, lon, isUser: true });
      }
    } catch (err) {
      // 실패해도 isUser=true 유지 (버튼 다시 안 뜨도록). 좌표는 서울 기본.
      console.warn("[uv] getCurrentLocation failed", err);
    }
  }, []);

  return {
    uv,
    level: uv != null ? levelFromUv(uv) : null,
    locationLabel: coords.isUser ? USER_LABEL : SEOUL_LABEL,
    loading,
    isUserLocation: coords.isUser,
    requestUserLocation,
  };
}
