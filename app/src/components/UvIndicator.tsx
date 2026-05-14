import { useState } from "react";
import { useUvIndex } from "../hooks/useUvIndex";
import { UvInfoSheet } from "./UvInfoSheet";

/**
 * 부가 정보 톤의 자외선 지수 표시.
 * - 기본: 서울 기준 UV 표시 (위치 권한 요청 X)
 * - 우측 작은 텍스트 버튼 "내 위치로 보기" → 클릭 시 SDK 권한 모달 → 좌표 갱신
 * - 라벨 옆 ⓘ 버튼 → UV 지수 단계·출처 안내 BottomSheet
 * - 작고 부드러운 회색 톤. 메인 정보(슬롯 리스트·CTA) 흐름 방해 X.
 */
export function UvIndicator() {
  const {
    uv,
    level,
    uvMax,
    uvMaxTime,
    sunset,
    locationLabel,
    loading,
    isUserLocation,
    requestUserLocation,
  } = useUvIndex();
  const [infoOpen, setInfoOpen] = useState(false);

  // 오늘 정점·일몰 한 줄 — 데이터 있을 때만 노출
  const footerParts: string[] = [];
  if (uvMax != null && uvMaxTime) {
    footerParts.push(`${uvMaxTime} UV ${Math.round(uvMax)} 정점`);
  } else if (uvMax != null) {
    footerParts.push(`오늘 UV 최고 ${Math.round(uvMax)}`);
  }
  if (sunset) {
    footerParts.push(`일몰 ${sunset}`);
  }

  return (
    <div
      style={{
        background: "#F8FAFC",
        borderRadius: 12,
        margin: "12px 0 4px",
        padding: "10px 14px",
      }}
    >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          minWidth: 0,
        }}
      >
        <span style={{ fontSize: 13, color: "#64748B" }}>☀️ 자외선</span>
        <button
          onClick={() => setInfoOpen(true)}
          aria-label="자외선 지수 안내"
          style={{
            width: 18,
            height: 18,
            padding: 0,
            borderRadius: "50%",
            border: "1px solid #CBD5E1",
            background: "#FFFFFF",
            color: "#64748B",
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
            flexShrink: 0,
          }}
        >
          i
        </button>
        {uv != null ? (
          <>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#0F172A",
              }}
            >
              {Math.round(uv)}
            </span>
            <span style={{ fontSize: 12, color: "#64748B" }}>· {level}</span>
          </>
        ) : (
          <span style={{ fontSize: 12, color: "#94A3B8" }}>
            {loading ? "불러오는 중" : "—"}
          </span>
        )}
        <span
          style={{
            fontSize: 11,
            color: isUserLocation ? "#2563EB" : "#94A3B8",
            fontWeight: isUserLocation ? 700 : 400,
            marginLeft: 4,
            whiteSpace: "nowrap",
          }}
        >
          {isUserLocation ? "📍 " : ""}
          {locationLabel}
        </span>
      </div>

      <button
        onClick={requestUserLocation}
        disabled={loading}
        style={{
          background: "transparent",
          border: "none",
          padding: "4px 8px",
          color: "#64748B",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          outline: "none",
          whiteSpace: "nowrap",
          opacity: loading ? 0.5 : 1,
        }}
      >
        {isUserLocation ? "새로고침" : "내 위치로 보기 ›"}
      </button>
    </div>

      {footerParts.length > 0 && (
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "#94A3B8",
            lineHeight: 1.4,
          }}
        >
          {footerParts.join(" · ")}
        </div>
      )}

      <UvInfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} />
    </div>
  );
}
