import { TossAds, getOperationalEnvironment } from "@apps-in-toss/web-framework";
import { useEffect, useRef, useState } from "react";

/**
 * 토스 인앱 배너 광고 슬롯.
 *
 * - 최초 1회 `TossAds.initialize` 호출 (idempotent하게 모듈 단위 가드).
 * - 마운트 시 `TossAds.attachBanner`로 슬롯 부착, 언마운트 시 destroy.
 * - dev / sandbox / PROD ID 미입력 시 자동으로 테스트 광고 그룹으로 폴백.
 * - SDK가 지원되지 않으면 placeholder 박스를 보여줘요(샌드박스/웹 디버깅 용).
 */

const TEST_AD_GROUP_ID = "ait-ad-test-banner-id";
const PROD_AD_GROUP_ID = "";

function resolveAdGroupId(): { id: string; isTest: boolean } {
  if (!PROD_AD_GROUP_ID) return { id: TEST_AD_GROUP_ID, isTest: true };
  if (import.meta.env.DEV) return { id: TEST_AD_GROUP_ID, isTest: true };
  try {
    if (getOperationalEnvironment() === "sandbox") {
      return { id: TEST_AD_GROUP_ID, isTest: true };
    }
  } catch {
    return { id: TEST_AD_GROUP_ID, isTest: true };
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
