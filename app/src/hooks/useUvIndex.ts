import { useEffect, useState } from "react";

/**
 * 자외선 지수(UV index) 조회 hook — 주요 도시 선택 방식.
 *
 * 동작:
 * - 토스 SDK 위치 권한을 쓰지 않아요. (샌드박스/실기기에서 권한 모달이 안 정상 동작해서 빼버림)
 * - 사용자가 주요 도시 중 하나를 선택 → 그 좌표로 UV/일출/일몰 fetch.
 * - 선택한 도시는 localStorage 영구 저장 (다음 진입 시 그 도시로 시작).
 * - UV 값은 도시 단위로 1시간 localStorage 캐시.
 * - Open-Meteo 공개 API에서 직접 fetch (서버 경유 X, key 없음, CORS OK).
 *
 * 부가 정보 용도라 실패해도 silently skip — 별도 에러 토스트 없음.
 */

export interface CityOption {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/**
 * 주요 도시 좌표 (KMA·공식 시청 위치 기준 근사).
 * 광역시 + 인구 많은 특례시 위주.
 */
export const CITIES: CityOption[] = [
  { id: "seoul", name: "서울", lat: 37.5665, lon: 126.978 },
  { id: "busan", name: "부산", lat: 35.1796, lon: 129.0756 },
  { id: "incheon", name: "인천", lat: 37.4563, lon: 126.7052 },
  { id: "daegu", name: "대구", lat: 35.8714, lon: 128.6014 },
  { id: "daejeon", name: "대전", lat: 36.3504, lon: 127.3845 },
  { id: "gwangju", name: "광주", lat: 35.1595, lon: 126.8526 },
  { id: "ulsan", name: "울산", lat: 35.5384, lon: 129.3114 },
  { id: "sejong", name: "세종", lat: 36.4801, lon: 127.289 },
  { id: "suwon", name: "수원", lat: 37.2636, lon: 127.0286 },
  { id: "changwon", name: "창원", lat: 35.228, lon: 128.6811 },
  { id: "jeonju", name: "전주", lat: 35.8242, lon: 127.148 },
  { id: "chuncheon", name: "춘천", lat: 37.8813, lon: 127.7298 },
  { id: "gangneung", name: "강릉", lat: 37.7519, lon: 128.8761 },
  { id: "jeju", name: "제주", lat: 33.4996, lon: 126.5312 },
];

const DEFAULT_CITY_ID = "seoul";
const CITY_KEY = "sunalarm.uv.city.v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간 — UV 값 캐시
const CACHE_KEY_PREFIX = "sunalarm.uv.v1";

function readSavedCityId(): string {
  try {
    const saved = window.localStorage.getItem(CITY_KEY);
    if (saved && CITIES.some((c) => c.id === saved)) return saved;
  } catch {
    // ignore
  }
  return DEFAULT_CITY_ID;
}

function writeSavedCityId(id: string): void {
  try {
    window.localStorage.setItem(CITY_KEY, id);
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
  uvMax: number | null;
  uvMaxTime: string | null;
  sunrise: string | null;
  sunset: string | null;
  ts: number;
}

function cacheKey(cityId: string): string {
  return `${CACHE_KEY_PREFIX}.${cityId}`;
}

function readCache(cityId: string): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(cityId));
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<CacheEntry>;
    if (typeof c.uv !== "number" || typeof c.ts !== "number") return null;
    if (Date.now() - c.ts > CACHE_TTL_MS) return null;
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
  cityId: string,
  entry: Omit<CacheEntry, "ts">,
): void {
  try {
    window.localStorage.setItem(
      cacheKey(cityId),
      JSON.stringify({ ...entry, ts: Date.now() }),
    );
  } catch {
    // ignore
  }
}

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
  uvMax: number | null;
  uvMaxTime: string | null;
  sunrise: string | null;
  sunset: string | null;
  /** 현재 선택된 도시 */
  city: CityOption;
  /** 사용 가능한 도시 목록 */
  cities: CityOption[];
  /** 도시 변경 — id 전달. localStorage에 자동 저장. */
  setCity: (id: string) => void;
  loading: boolean;
}

function findCity(id: string): CityOption {
  return CITIES.find((c) => c.id === id) ?? CITIES[0];
}

export function useUvIndex(): UvState {
  const [cityId, setCityIdState] = useState<string>(() => readSavedCityId());
  const city = findCity(cityId);

  const [uv, setUv] = useState<number | null>(null);
  const [uvMax, setUvMax] = useState<number | null>(null);
  const [uvMaxTime, setUvMaxTime] = useState<string | null>(null);
  const [sunrise, setSunrise] = useState<string | null>(null);
  const [sunset, setSunset] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 도시 변경 시 UV 재조회 (캐시 우선)
  useEffect(() => {
    const cached = readCache(cityId);
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
    void fetchUvFromOpenMeteo(city.lat, city.lon).then((entry) => {
      if (!alive) return;
      if (entry != null) {
        setUv(entry.uv);
        setUvMax(entry.uvMax);
        setUvMaxTime(entry.uvMaxTime);
        setSunrise(entry.sunrise);
        setSunset(entry.sunset);
        writeCache(cityId, entry);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [cityId, city.lat, city.lon]);

  const setCity = (id: string) => {
    if (!CITIES.some((c) => c.id === id)) return;
    setCityIdState(id);
    writeSavedCityId(id);
  };

  return {
    uv,
    level: uv != null ? levelFromUv(uv) : null,
    uvMax,
    uvMaxTime,
    sunrise,
    sunset,
    city,
    cities: CITIES,
    setCity,
    loading,
  };
}
