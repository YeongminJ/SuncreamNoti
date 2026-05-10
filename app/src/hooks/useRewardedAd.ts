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

export type AdState = "idle" | "loading" | "showing" | "unsupported" | "error";

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

/**
 * 보상형 광고 hook — on-demand 로딩 방식.
 *
 * 마운트 시점에는 광고를 미리 로드하지 않아요. 사용자가 `show()`를 호출한
 * 시점에 `loadFullScreenAd`를 호출하고, `loaded` 이벤트가 오면 곧바로
 * `showFullScreenAd`로 이어서 표시해요. 진행 중일 때 중복 호출은 무시돼요.
 */
export function useRewardedAd() {
  const [state, setState] = useState<AdState>(() => {
    if (sdkIsAvailable()) return "idle";
    return import.meta.env.DEV ? "idle" : "unsupported";
  });
  const [adGroupInfo] = useState(() => resolveAdGroupId());
  const adGroupId = adGroupInfo.id;
  // 진행 중인 load의 unregister + 중복 클릭 방지
  const inFlightRef = useRef<{ unregister?: () => void } | null>(null);

  // 언마운트 시 진행 중인 load 핸들러 해제
  useEffect(() => {
    return () => {
      inFlightRef.current?.unregister?.();
      inFlightRef.current = null;
    };
  }, []);

  const show = useCallback(
    (onRewarded: () => void, onFailed?: () => void) => {
      // SDK 미지원 환경: dev는 시뮬레이션, prod는 실패 처리
      if (!sdkIsAvailable()) {
        if (import.meta.env.DEV) {
          console.debug("[ad] DEV simulate rewarded after 600ms");
          setState("showing");
          window.setTimeout(() => {
            setState("idle");
            onRewarded();
          }, 600);
          return;
        }
        onFailed?.();
        return;
      }

      // 이미 진행 중이면 중복 호출 무시 (사용자 빠른 더블탭 방지)
      if (inFlightRef.current) return;

      setState("loading");
      let settled = false;
      let earned = false;

      const cleanup = () => {
        inFlightRef.current?.unregister?.();
        inFlightRef.current = null;
      };

      const finishWith = (rewarded: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (rewarded) onRewarded();
        else onFailed?.();
      };

      const showLoadedAd = () => {
        setState("showing");
        const result = safeCall(showFullScreenAd, {
          options: { adGroupId },
          onEvent: (event) => {
            switch (event.type) {
              case "userEarnedReward":
                earned = true;
                break;
              case "dismissed":
                setState("idle");
                finishWith(earned);
                break;
              case "failedToShow":
                setState("idle");
                finishWith(false);
                break;
            }
          },
          onError: (err) => {
            console.warn("[ad] show failed", err);
            setState("error");
            finishWith(false);
          },
        });
        if (result === null) {
          setState("unsupported");
          finishWith(false);
        }
      };

      // 클릭 시점에 load 시작 → loaded 받으면 즉시 show
      const unregister = safeCall(loadFullScreenAd, {
        options: { adGroupId },
        onEvent: (event) => {
          if (event.type === "loaded") {
            showLoadedAd();
          }
        },
        onError: (err) => {
          console.warn("[ad] load failed", err);
          setState("error");
          finishWith(false);
        },
      });

      if (unregister === null) {
        setState("unsupported");
        finishWith(false);
        return;
      }

      inFlightRef.current = { unregister: unregister as () => void };
    },
    [adGroupId],
  );

  return {
    state,
    ready: state === "idle",
    loading: state === "loading",
    supported: state !== "unsupported",
    isTest: adGroupInfo.isTest,
    show,
  };
}
