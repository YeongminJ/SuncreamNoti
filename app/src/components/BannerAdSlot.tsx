import { TossAds } from "@apps-in-toss/web-framework";
import { useEffect, useRef, useState } from "react";

/**
 * 토스 인앱 배너 광고 슬롯.
 *
 * - 최초 1회 `TossAds.initialize` 호출 (idempotent하게 모듈 단위 가드).
 * - 마운트 시 `TossAds.attachBanner`로 슬롯 부착, 언마운트 시 destroy.
 * - 토스 검수 정책상 출시 번들에 테스트 광고 그룹 ID 문자열이 포함되면 안 되므로
 *   dev 빌드에서만 테스트 ID를 쓰고 prod 빌드(출시·sandbox 모두)는 실제 ID 사용.
 *   dev 분기는 Vite DCE로 prod 번들에서 제거돼요.
 * - SDK가 지원되지 않으면 placeholder 박스를 보여줘요(웹 디버깅 용).
 */

const PROD_AD_GROUP_ID = "ait.v2.live.8c5302ad3bfc466d";

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

let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  if (!safeIsSupported(TossAds?.initialize)) return;
  try {
    TossAds.initialize({
      callbacks: {
        onInitialized: () => {
          if (import.meta.env.DEV) console.debug("[ad] TossAds initialized");
        },
        onInitializationFailed: (err) =>
          console.warn("[ad] TossAds init failed", err),
      },
    });
    initialized = true;
  } catch (err) {
    console.warn("[ad] TossAds init threw", err);
  }
}

export function BannerAdSlot() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [supported, setSupported] = useState<boolean>(true);
  const adGroupInfoRef = useRef(resolveAdGroupId());

  useEffect(() => {
    ensureInitialized();
    const supportedNow = safeIsSupported(TossAds?.attachBanner);
    setSupported(supportedNow);
    if (!supportedNow) return;
    if (!ref.current) return;

    let result: { destroy: () => void } | null = null;
    try {
      result = TossAds.attachBanner(adGroupInfoRef.current.id, ref.current, {
        variant: "card",
        theme: "auto",
      });
    } catch (err) {
      console.warn("[ad] attachBanner failed", err);
    }
    return () => {
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
