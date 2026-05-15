import { appLogin } from "@apps-in-toss/web-framework";
import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";

/**
 * 토스 로그인이 실패한 사용자에게 재시도를 유도하는 배너.
 *
 * App.tsx step 1의 appLogin 분기 로직을 그대로 따라가요 (setLoggedIn / setSkipped / setFailed).
 * - `setSkipped`는 정상 케이스(이미 매핑됐거나 토스 환경 아님)니까 배너 표시 안 함.
 * - 오직 `status === "failed"`일 때만 노출.
 *
 * 검수 통과 우선이라 dismiss(이번 세션 닫기) 기능은 의도적으로 추가하지 않았어요.
 */
export function AuthFailedBanner() {
  const status = useAuthStore((s) => s.status);
  const [retrying, setRetrying] = useState(false);

  if (status !== "failed") return null;

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    const auth = useAuthStore.getState();
    auth.setPending();
    try {
      const result = await appLogin();
      if (
        result &&
        typeof result === "object" &&
        "authorizationCode" in result &&
        typeof result.authorizationCode === "string"
      ) {
        const referrer =
          "referrer" in result && result.referrer === "SANDBOX"
            ? "SANDBOX"
            : "DEFAULT";
        auth.setLoggedIn({
          authorizationCode: result.authorizationCode,
          referrer,
        });
      } else {
        // 토스 환경 아님 (브라우저 dev 등) — 게스트로 진행
        auth.setSkipped();
      }
    } catch (err) {
      console.warn("[banner] appLogin retry failed", err);
      useAuthStore.getState().setFailed();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      style={{
        margin: "0 24px 16px",
        padding: "14px 16px",
        background: "#FFF7E6",
        border: "1px solid #FFE0A8",
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
      role="status"
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#7A4A12",
            marginBottom: 2,
          }}
        >
          알림을 받으려면 토스 로그인이 필요해요
        </div>
        <div style={{ fontSize: 12, color: "#8B6A3C" }}>
          로그인하면 발림 시간에 푸시로 알려드려요
        </div>
      </div>
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        style={{
          flexShrink: 0,
          padding: "8px 14px",
          background: retrying ? "#E5C28A" : "#FF9B3C",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          cursor: retrying ? "default" : "pointer",
        }}
      >
        {retrying ? "시도 중…" : "지금 로그인"}
      </button>
    </div>
  );
}
