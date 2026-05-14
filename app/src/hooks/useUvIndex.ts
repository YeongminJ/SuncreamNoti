import { Accuracy, getCurrentLocation } from "@apps-in-toss/web-framework";
import { useCallback, useEffect, useState } from "react";

/**
 * 자외선 지수(UV index) 조회 hook.
 *
 * 동작:
 * - 기본 좌표는 **서울**. 위치 권한 요청 없이 즉시 표시.
 * - 사용자가 "내 위치로 보기"를 클릭하면 그때 토스 SDK `getCurrentLocation` 호출 → 권한 모달 노출.
 * - 한 번이라도 권한을 받았으면 다음 진입부터는 자동으로 fresh 좌표 재요청 (캐싱 X).
 * - UV 값은 좌표(소수 1자리) 단위로 1시간 localStorage 캐시.
 * - Open-Meteo 공개 API에서 직접 fetch (서버 경유 X, key 없음, CORS OK).
 *
 * 부가 정보 용도라 실패해도 silently skip — 별도 에러 토스트 없음.
 */

const DEFAULT_LAT = 37.5665;
const DEFAULT_LON = 126.978;
const SEOUL_LABEL = "서울 기준";
const USER_LABEL = "내 위치";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간 — UV 값 캐시
const CACHE_KEY_PREFIX = "sunalarm.uv.v1";
/** "이 사용자는 위치 권한을 한 번 동의했음" 영속 플래그. */
const LOCATION_GRANTED_KEY = "sunalarm.uv.locationGranted.v1";
/** 좌표 캐시 — 토스 SDK getCurrentLocation 재호출 줄여서 권한 모달 반복 방지. */
const COORDS_CACHE_KEY = "sunalarm.uv.coords.v1";
const COORDS_CACHE_TTL_MS = 30 * 60 * 1000; // 30분

function readGrantedFlag(): boolean {
  try {
    return window.localStorage.getItem(LOCATION_GRANTED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeGrantedFlag(granted: boolean): void {
  try {
    if (granted) {
      window.localStorage.setItem(LOCATION_GRANTED_KEY, "1");
    } else {
      window.localStorage.removeItem(LOCATION_GRANTED_KEY);
    }
  } catch {
    // ignore
  }
}

interface CoordsCacheEntry {
  lat: number;
  lon: number;
  ts: number;
}

function readCoordsCache(): CoordsCacheEntry | null {
  try {
    const raw = window.localStorage.getItem(COORDS_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CoordsCacheEntry;
    if (
      typeof c.lat !== "number" ||
      typeof c.lon !== "number" ||
      typeof c.ts !== "number"
    )
      return null;
    if (Date.now() - c.ts > COORDS_CACHE_TTL_MS) return null;
    return c;
  } catch {
    return null;
  }
}

function writeCoordsCache(lat: number, lon: number): void {
  try {
    window.localStorage.setItem(
      COORDS_CACHE_KEY,
      JSON.stringify({ lat, lon, ts: Date.now() }),
    );
  } catch {
    // ignore
  }
}

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
  /** 오늘 UV 정점 값 (Open-Meteo `daily.uv_index_max`) */
  uvMax: number | null;
  /** 오늘 UV 정점 시각 — "HH:MM" 포맷 */
  uvMaxTime: string | null;
  /** 일출 "HH:MM" */
  sunrise: string | null;
  /** 일몰 "HH:MM" */
  sunset: string | null;
  ts: number;
}

function cacheKey(lat: number, lon: number): string {
  return `${CACHE_KEY_PREFIX}.${lat.toFixed(1)}.${lon.toFixed(1)}`;
}

function readCache(lat: number, lon: number): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(lat, lon));
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<CacheEntry>;
    if (typeof c.uv !== "number" || typeof c.ts !== "number") return null;
    if (Date.now() - c.ts > CACHE_TTL_MS) return null;
    // 누락 필드는 null 채워서 호환
    return {
      uv: c.uv,
      uvMax: typeof c.uvMax === "number" ? c.uvMax : null,
      uvMaxTime: typeof c.uvMaxTime === "string" ? c.uvMaxTime : null,
      sunrise: typeof c.sunrise === "string" ? c.sunrise : null,
      sunset: typeof c.sunset === "string" ? c.sunset : null,
      ts: c.ts,
    };
  } catch {
    return null;
  }
}

function writeCache(
  lat: number,
  lon: number,
  entry: Omit<CacheEntry, "ts">,
): void {
  try {
    window.localStorage.setItem(
      cacheKey(lat, lon),
      JSON.stringify({ ...entry, ts: Date.now() }),
    );
  } catch {
    // ignore
  }
}

/** "2026-05-14T13:00" → "13:00" */
function timeOfDay(iso: string | undefined | null): string | null {
  if (typeof iso !== "string") return null;
  const m = iso.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : null;
}

interface OpenMeteoResponse {
  current?: { uv_index?: number };
  hourly?: {
    time?: string[];
    uv_index?: number[];
  };
  daily?: {
    time?: string[];
    uv_index_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
}

async function fetchUvFromOpenMeteo(
  lat: number,
  lon: number,
): Promise<Omit<CacheEntry, "ts"> | null> {
  // 한 번의 호출로 현재 UV + 오늘 정점 + 일출/일몰까지 받아옴.
  // forecast_days=1로 오늘 데이터만 받아서 페이로드 작게 유지.
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}` +
    `&longitude=${lon}` +
    `&current=uv_index` +
    `&hourly=uv_index` +
    `&daily=uv_index_max,sunrise,sunset` +
    `&forecast_days=1` +
    `&timezone=Asia%2FSeoul`;
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;
    const json = (await res.json()) as OpenMeteoResponse;
    const uv = json.current?.uv_index;
    if (typeof uv !== "number") return null;

    // 오늘 hourly UV에서 최대값 인덱스 찾아 시각 추출
    let uvMaxTime: string | null = null;
    const hours = json.hourly?.uv_index;
    const times = json.hourly?.time;
    if (Array.isArray(hours) && Array.isArray(times) && hours.length > 0) {
      let maxIdx = 0;
      for (let i = 1; i < hours.length; i++) {
        if ((hours[i] ?? 0) > (hours[maxIdx] ?? 0)) maxIdx = i;
      }
      uvMaxTime = timeOfDay(times[maxIdx]);
    }

    return {
      uv,
      uvMax: json.daily?.uv_index_max?.[0] ?? null,
      uvMaxTime,
      sunrise: timeOfDay(json.daily?.sunrise?.[0]),
      sunset: timeOfDay(json.daily?.sunset?.[0]),
    };
  } catch {
    return null;
  }
}

export interface UvState {
  uv: number | null;
  level: UvLevel | null;
  /** 오늘 UV 정점 값 */
  uvMax: number | null;
  /** 오늘 UV 정점 시각 — "HH:MM" */
  uvMaxTime: string | null;
  /** 오늘 일출 시각 — "HH:MM" */
  sunrise: string | null;
  /** 오늘 일몰 시각 — "HH:MM" */
  sunset: string | null;
  locationLabel: string;
  loading: boolean;
  isUserLocation: boolean;
  /** 클릭 시 권한 요청 + 좌표 갱신. 거부되거나 실패하면 서울 유지. */
  requestUserLocation: () => Promise<void>;
}

/**
 * 토스 SDK 권한 플로우 → 좌표 반환.
 *
 * SDK 동작 특성상 `getCurrentLocation({...})`만 직접 호출하면
 * 권한 모달은 부수효과로 뜨지만 promise는 사용자 응답 전에 reject돼서
 * "허용"을 눌러도 좌표를 못 받는 케이스가 발생함.
 *
 * 그래서 다음 순서로 처리:
 *   1) getPermission()으로 현재 권한 상태 확인
 *   2) 미허용이면 openPermissionDialog()로 모달 띄우고 사용자 응답까지 대기
 *   3) 허용된 경우에만 getCurrentLocation({...}) 호출
 *
 * 실패/거부면 null. 호출자에서 fallback 처리.
 */
async function fetchCurrentCoords(): Promise<{
  lat: number;
  lon: number;
} | null> {
  if (typeof getCurrentLocation !== "function") return null;
  try {
    let permission: string = await getCurrentLocation.getPermission();
    if (permission !== "granted") {
      permission = await getCurrentLocation.openPermissionDialog();
    }
    if (permission !== "granted") return null;

    const result = await getCurrentLocation({ accuracy: Accuracy.Balanced });
    const lat = result?.coords?.latitude;
    const lon = result?.coords?.longitude;
    if (typeof lat === "number" && typeof lon === "number") {
      return { lat, lon };
    }
  } catch (err) {
    console.warn("[uv] getCurrentLocation failed", err);
  }
  return null;
}

export function useUvIndex(): UvState {
  // 이전 동의 이력 + 캐시된 좌표가 있으면 그걸로 즉시 시작 (권한 모달 안 뜸).
  // 캐시 없으면 서울 좌표로 시작하고, 마운트 후 fresh 좌표 fetch.
  const [coords, setCoords] = useState<{
    lat: number;
    lon: number;
    isUser: boolean;
  }>(() => {
    const cached = readCoordsCache();
    const granted = readGrantedFlag();
    if (granted && cached) {
      return { lat: cached.lat, lon: cached.lon, isUser: true };
    }
    return { lat: DEFAULT_LAT, lon: DEFAULT_LON, isUser: granted };
  });
  const [uv, setUv] = useState<number | null>(null);
  const [uvMax, setUvMax] = useState<number | null>(null);
  const [uvMaxTime, setUvMaxTime] = useState<string | null>(null);
  const [sunrise, setSunrise] = useState<string | null>(null);
  const [sunset, setSunset] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 진입 시 동의 이력 있는데 좌표 캐시 만료된 경우만 SDK 호출.
  // 캐시 살아있으면 fetch 안 함 → 권한 모달 반복 노출 방지.
  useEffect(() => {
    if (!readGrantedFlag()) return;
    if (readCoordsCache()) return;
    let alive = true;
    void fetchCurrentCoords().then((c) => {
      if (!alive || !c) return;
      writeCoordsCache(c.lat, c.lon);
      setCoords({ lat: c.lat, lon: c.lon, isUser: true });
    });
    return () => {
      alive = false;
    };
  }, []);

  // coords 변경 시 UV + 오늘 정점·일출·일몰 재조회 (캐시 우선)
  useEffect(() => {
    const cached = readCache(coords.lat, coords.lon);
    if (cached) {
      setUv(cached.uv);
      setUvMax(cached.uvMax);
      setUvMaxTime(cached.uvMaxTime);
      setSunrise(cached.sunrise);
      setSunset(cached.sunset);
      return;
    }
    let alive = true;
    setLoading(true);
    void fetchUvFromOpenMeteo(coords.lat, coords.lon).then((entry) => {
      if (!alive) return;
      if (entry != null) {
        setUv(entry.uv);
        setUvMax(entry.uvMax);
        setUvMaxTime(entry.uvMaxTime);
        setSunrise(entry.sunrise);
        setSunset(entry.sunset);
        writeCache(coords.lat, coords.lon, entry);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [coords.lat, coords.lon]);

  const requestUserLocation = useCallback(async () => {
    if (typeof getCurrentLocation !== "function") return;
    // 옵티미스틱: 클릭한 순간 라벨/버튼 즉시 갱신
    setCoords((prev) => ({ ...prev, isUser: true }));
    const c = await fetchCurrentCoords();
    if (c) {
      writeCoordsCache(c.lat, c.lon);
      setCoords({ lat: c.lat, lon: c.lon, isUser: true });
      writeGrantedFlag(true);
      return;
    }
    // 좌표 fetch 실패: 권한 거부 또는 SDK 오류.
    // 옵티미스틱 라벨을 롤백해 "내 위치"인데 서울 데이터인 불일치 상태를 막음.
    setCoords((prev) => ({ ...prev, isUser: false }));
    writeGrantedFlag(false);
  }, []);

  return {
    uv,
    level: uv != null ? levelFromUv(uv) : null,
    uvMax,
    uvMaxTime,
    sunrise,
    sunset,
    locationLabel: coords.isUser ? USER_LABEL : SEOUL_LABEL,
    loading,
    isUserLocation: coords.isUser,
    requestUserLocation,
  };
}
