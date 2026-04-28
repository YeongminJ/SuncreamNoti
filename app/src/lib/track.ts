import { Analytics } from "@apps-in-toss/web-framework";

/** Apps-in-Toss Analytics 안전 래퍼 (참고 앱과 동일 패턴). */
export type TrackParams = Record<
  string,
  string | number | boolean | undefined | null
>;

function cleanParams(
  params?: TrackParams,
): Record<string, string | number | boolean> {
  if (!params) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

function safe(
  fn: ((params?: TrackParams) => unknown) | undefined,
  logName: string,
  params?: TrackParams,
): void {
  const cleaned = cleanParams(params);
  if (import.meta.env.DEV) {
    console.debug("[track]", logName, cleaned);
  }
  if (typeof fn !== "function") return;
  try {
    const result = fn({ log_name: logName, ...cleaned });
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      (result as Promise<unknown>).catch((err) => {
        console.warn("[track] failed", logName, err);
      });
    }
  } catch (err) {
    console.warn("[track] threw", logName, err);
  }
}

export function trackScreen(name: string, params?: TrackParams): void {
  safe(Analytics?.screen, name, params);
}

export function trackClick(name: string, params?: TrackParams): void {
  safe(Analytics?.click, name, params);
}

export function trackImpression(name: string, params?: TrackParams): void {
  safe(Analytics?.impression, name, params);
}
