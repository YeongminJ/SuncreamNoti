import { useEffect, useState } from "react";
import { getUserKey } from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";

/**
 * 운영자 디버그 가드 — `?whoami=1` 쿼리 있을 때만 우상단에 본인 식별 칩 표시.
 *
 * - user_key: 서버 PK (익명 해시)
 * - tossUserKey: 토스 numeric key (스마트 발송 대상)
 * - 일반 사용자에겐 안 보임. 진입 URL 끝에 `?whoami=1` 붙여야만 노출.
 * - CS 응대·본인 D1 조회·검증 시 본인 키 확인 용도.
 *
 * 사용: `intoss-private://dailysuncream?whoami=1` 또는 dev에서 `?whoami=1`
 */
export function WhoAmIBadge() {
  const tossUserKey = useAuthStore((s) => s.tossUserKey);
  const authStatus = useAuthStore((s) => s.status);
  const [userKey, setUserKey] = useState<string | null>(null);

  const enabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("whoami");

  useEffect(() => {
    if (!enabled) return;
    void getUserKey().then(setUserKey);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 9999,
        padding: "8px 10px",
        background: "rgba(15, 23, 42, 0.88)",
        color: "#F8FAFC",
        fontSize: 10,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        borderRadius: 8,
        maxWidth: 260,
        wordBreak: "break-all",
        lineHeight: 1.5,
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        pointerEvents: "none",
      }}
    >
      <div style={{ opacity: 0.6 }}>uk</div>
      <div style={{ marginBottom: 4 }}>{userKey ?? "loading..."}</div>
      <div style={{ opacity: 0.6 }}>tuk · auth</div>
      <div>
        {tossUserKey ?? "—"} · {authStatus}
      </div>
    </div>
  );
}
