import { TossAds } from "@apps-in-toss/web-framework";
import { useEffect, useRef, useState } from "react";

/**
 * 토스 인앱 배너 광고 슬롯.
 *
 * - `TossAds.initialize`는 비동기 → `onInitialized` 콜백까지 await 후 `attachBanner` 호출.
 *   이전엔 init 호출 직후 곧바로 attach해서 첫 진입에서 배너가 안 보이고
 *   리워드 광고 본 뒤(=init 완료 후)에야 보이던 버그가 있었음.
 * - 모듈 단위 init promise를 캐시(idempotent)해서 여러 슬롯이 마운트돼도 한 번만 init.
 * - 토스 검수 정책상 출시 번들에 테스트 광고 그룹 ID 문자열이 포함되면 안 되므로
 *   dev 빌드에서만 테스트 ID를 쓰고 prod 빌드(출시·sandbox 모두)는 실제 ID 사용.
 *   dev 분기는 Vite DCE로 prod 번들에서 제거돼요.
 * - SDK가 지원되지 않으면 placeholder 박스를 보여줘요(웹 디버깅 용).
 */

const PROD_AD_GROUP_ID = "ait.v2.live.8c5302ad3bfc466d";
/** init 응답이 너무 늦으면(8s 초과) 실패 처리해서 placeholder로 폴백 */
const INIT_TIMEOUT_MS = 8000;

function resolveAdGroupId(): { id: string; isTest: boolean } {
  if (import.meta.env.DEV) {
    return { id: "ait-ad-test-banner-id", isTest: true };
  }
  return { id: PROD_AD_GROUP_ID, isTest: false };
}

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

let initPromise: Promise<boolean> | null = null;
function ensureInitialized(): Promise<boolean> {
  if (initPromise) return initPromise;
  if (!safeIsSupported(TossAds?.initialize)) {
    return Promise.resolve(false);
  }
  initPromise = new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timeoutId = window.setTimeout(() => {
      console.warn("[ad] TossAds init timeout");
      settle(false);
    }, INIT_TIMEOUT_MS);

    try {
      TossAds.initialize({
        callbacks: {
          onInitialized: () => {
            window.clearTimeout(timeoutId);
            if (import.meta.env.DEV) console.debug("[ad] TossAds initialized");
            settle(true);
          },
          onInitializationFailed: (err) => {
            window.clearTimeout(timeoutId);
            console.warn("[ad] TossAds init failed", err);
            settle(false);
          },
        },
      });
    } catch (err) {
      window.clearTimeout(timeoutId);
      console.warn("[ad] TossAds init threw", err);
      settle(false);
    }
  });
  return initPromise;
}

export function BannerAdSlot() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [supported, setSupported] = useState<boolean>(true);
  const adGroupInfoRef = useRef(resolveAdGroupId());

  useEffect(() => {
    let alive = true;
    let result: { destroy: () => void } | null = null;

    void ensureInitialized().then((ok) => {
      if (!alive) return;
      if (!ok || !safeIsSupported(TossAds?.attachBanner)) {
        setSupported(false);
        return;
      }
      if (!ref.current) return;
      try {
        result = TossAds.attachBanner(
          adGroupInfoRef.current.id,
          ref.current,
          {
            variant: "card",
            theme: "auto",
          },
        );
      } catch (err) {
        console.warn("[ad] attachBanner failed", err);
      }
    });

    return () => {
      alive = false;
      try {
        result?.destroy();
      } catch (err) {
        console.warn("[ad] banner destroy failed", err);
      }
    };
  }, []);

  if (!supported) {
    return (
      <div
        style={{
          margin: "16px 0",
          padding: 16,
          borderRadius: 14,
          background: "#F4F4F5",
          color: "#9CA3AF",
          fontSize: 12,
          textAlign: "center",
        }}
      >
        배너 광고 미리보기 (실기기·샌드박스에서 노출)
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{ margin: "16px 0", minHeight: 64 }}
      aria-label="배너 광고"
    />
  );
}
