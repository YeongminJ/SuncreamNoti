import { useUvIndex } from "../hooks/useUvIndex";

/**
 * 부가 정보 톤의 자외선 지수 표시.
 * - 기본: 서울 기준 UV 표시 (위치 권한 요청 X)
 * - 우측 작은 텍스트 버튼 "내 위치로 보기" → 클릭 시 SDK 권한 모달 → 좌표 갱신
 * - 작고 부드러운 회색 톤. 메인 정보(슬롯 리스트·CTA) 흐름 방해 X.
 */
export function UvIndicator() {
  const { uv, level, locationLabel, loading, isUserLocation, requestUserLocation } =
    useUvIndex();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 14px",
        background: "#F8FAFC",
        borderRadius: 12,
        margin: "12px 0 4px",
        minHeight: 44,
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
            color: "#94A3B8",
            marginLeft: 4,
            whiteSpace: "nowrap",
          }}
        >
          {locationLabel}
        </span>
      </div>

      {!isUserLocation && (
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
          내 위치로 보기 ›
        </button>
      )}
    </div>
  );
}
