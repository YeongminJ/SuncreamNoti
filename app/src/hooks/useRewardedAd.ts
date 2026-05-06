import {
  loadFullScreenAd,
  showFullScreenAd,
} from "@apps-in-toss/web-framework";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 보상형 광고 그룹 ID.
 *
 * Apps-in-Toss는 전면형/보상형을 통합 API(`loadFullScreenAd`/`showFullScreenAd`)
 * 로 제공해요. 광고 그룹 ID 자체가 보상형/전면형을 구분해요.
 *
 * 토스 검수 정책: 출시 번들에 테스트 광고 그룹 ID 문자열이 포함되면 안 돼요.
 * 그래서 dev 빌드에서만 테스트 ID를 사용하고, prod 빌드(출시·sandbox 모두)는
 * 콘솔에서 발급된 실제 ID를 쓰도록 분기해요. dev 빌드의 테스트 ID 분기는
 * Vite의 DCE로 prod 번들에서 제거돼요.
 */
const PROD_AD_GROUP_ID = "ait.v2.live.33e4a898cf514cc4";

function resolveAdGroupId(): { id: string; isTest: boolean } {
  if (import.meta.env.DEV) {
    // 브라우저 dev에서는 SDK 미지원 → 시뮬레이션이 동작하므로 ID는 자리만 채움.
    return { id: "ait-ad-test-rewarded-id", isTest: true };
  }
  return { id: PROD_AD_GROUP_ID, isTest: false };
}

export type AdState =
  | "unsupported"
  | "loading"
  | "ready"
  | "showing"
  | "error";

function safeIsSupported(
  fn: { isSupported?: () => boolean } | undefined,
): boolean {
  if (!fn || typeof fn.isSupported !== "function") return false;
  try {
    return fn.isSupported();
  } catch {
    return false;
  }
}

function safeCall<T extends (...args: never[]) => unknown>(
  fn: T | undefined,
  ...args: Parameters<T>
): ReturnType<T> | null {
  if (typeof fn !== "function") return null;
  try {
    return fn(...args) as ReturnType<T>;
  } catch (err) {
    console.warn("[ad] SDK call failed", err);
    return null;
  }
}

function sdkIsAvailable(): boolean {
  return (
    safeIsSupported(loadFullScreenAd) && safeIsSupported(showFullScreenAd)
  );
}

export function useRewardedAd() {
  const [state, setState] = useState<AdState>(() =>
    sdkIsAvailable() ? "loading" : import.meta.env.DEV ? "ready" : "unsupported",
  );
  const [adGroupInfo] = useState(() => resolveAdGroupId());
  const adGroupId = adGroupInfo.id;
  const pendingShowRef = useRef<{
    onRewarded: () => void;
    onFailed?: () => void;
  } | null>(null);

  const showLoadedAd = useCallback(
    (onRewarded: () => void, onFailed?: () => void) => {
      if (!safeIsSupported(showFullScreenAd)) {
        onFailed?.();
        return;
      }
      setState("showing");
      let settled = false;
      let earned = false;
      const preloadNext = () => {
        if (!sdkIsAvailable()) return;
        safeCall(loadFullScreenAd, {
          options: { adGroupId },
          onEvent: (e) => {
            if (e.type === "loaded") setState("ready");
          },
          onError: () => setState("error"),
        });
      };
      const result = safeCall(showFullScreenAd, {
        options: { adGroupId },
        onEvent: (event) => {
          switch (event.type) {
            case "userEarnedReward":
              earned = true;
              break;
            case "dismissed":
              setState("loading");
              preloadNext();
              if (settled) break;
              settled = true;
              if (earned) onRewarded();
              else onFailed?.();
              break;
            case "failedToShow":
              setState("loading");
              preloadNext();
              if (settled) break;
              settled = true;
              onFailed?.();
              break;
          }
        },
        onError: (err) => {
          console.warn("[ad] show failed", err);
          setState("error");
          if (settled) return;
          settled = true;
          onFailed?.();
        },
      });
      if (result === null) {
        setState("unsupported");
        if (!settled) {
          settled = true;
          onFailed?.();
        }
      }
    },
    [adGroupId],
  );

  useEffect(() => {
    if (!sdkIsAvailable()) {
      setState("unsupported");
      return;
    }
    setState("loading");
    const unregister = safeCall(loadFullScreenAd, {
      options: { adGroupId },
      onEvent: (event) => {
        if (event.type === "loaded") {
          setState("ready");
          const pending = pendingShowRef.current;
          if (pending) {
            pendingShowRef.current = null;
            showLoadedAd(pending.onRewarded, pending.onFailed);
          }
        }
      },
      onError: (err) => {
        console.warn("[ad] load failed", err);
        setState("error");
        const pending = pendingShowRef.current;
        pendingShowRef.current = null;
        pending?.onFailed?.();
      },
    });
    if (unregister === null) {
      setState("unsupported");
      return;
    }
    return () => unregister();
  }, [adGroupId, showLoadedAd]);

  const show = useCallback(
    (onRewarded: () => void, onFailed?: () => void) => {
      if (!sdkIsAvailable()) {
        // Dev / 브라우저 환경: 광고 SDK가 없을 때 흐름을 검증할 수 있도록
        // 600ms 후 보상 시뮬레이션. 실기기·샌드박스에서는 이 분기를 타지 않아요.
        if (import.meta.env.DEV) {
          console.debug("[ad] DEV simulate rewarded after 600ms");
          setState("showing");
          window.setTimeout(() => {
            setState("ready");
            onRewarded();
          }, 600);
          return;
        }
        onFailed?.();
        return;
      }
      if (state === "ready") {
        showLoadedAd(onRewarded, onFailed);
        return;
      }
      if (state === "loading") {
        pendingShowRef.current = { onRewarded, onFailed };
        return;
      }
      onFailed?.();
    },
    [state, showLoadedAd],
  );

  return {
    state,
    ready: state === "ready",
    loading: state === "loading",
    supported: state !== "unsupported",
    isTest: adGroupInfo.isTest,
    show,
  };
}
