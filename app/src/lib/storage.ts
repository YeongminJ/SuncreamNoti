/** 안전한 localStorage wrapper. SSR/샌드박스 양쪽에서 무사. */

function safeGet(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const ls = safeGet();
  if (!ls) return fallback;
  try {
    const v = ls.getItem(key);
    if (v == null) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  const ls = safeGet();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / serialization
  }
}

export function removeKey(key: string): void {
  const ls = safeGet();
  if (!ls) return;
  try {
    ls.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * `sunalarm.` 프리픽스가 붙은 모든 localStorage 키를 제거.
 * 반환값은 삭제된 키 수.
 */
export function clearAllSunalarmKeys(): number {
  const ls = safeGet();
  if (!ls) return 0;
  const toRemove: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.startsWith("sunalarm.")) toRemove.push(k);
  }
  toRemove.forEach((k) => {
    try {
      ls.removeItem(k);
    } catch {
      // ignore
    }
  });
  return toRemove.length;
}
