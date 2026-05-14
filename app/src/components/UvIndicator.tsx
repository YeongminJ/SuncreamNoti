import { useState } from "react";
import { useUvIndex } from "../hooks/useUvIndex";
import { CityPickerSheet } from "./CityPickerSheet";
import { UvInfoSheet } from "./UvInfoSheet";

/**
 * 부가 정보 톤의 자외선 지수 표시.
 * - 사용자가 선택한 주요 도시 기준으로 UV 노출 (기본 서울)
 * - 우측 "지역" 버튼 → CityPickerSheet에서 도시 변경 가능
 * - 라벨 옆 ⓘ 버튼 → UV 지수 단계·출처 안내 BottomSheet
 */
export function UvIndicator() {
  const { uv, level, uvMax, uvMaxTime, sunset, loading, city, cities, setCity } =
    useUvIndex();
  const [infoOpen, setInfoOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);

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
              color: "#64748B",
              marginLeft: 4,
              whiteSpace: "nowrap",
            }}
          >
            {city.name}
          </span>
        </div>

        <button
          onClick={() => setCityOpen(true)}
          disabled={loading}
          style={{
            background: "transparent",
            border: "none",
            padding: "4px 8px",
            color: "#2563EB",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            outline: "none",
            whiteSpace: "nowrap",
            opacity: loading ? 0.5 : 1,
          }}
        >
          지역 변경 ›
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
      <CityPickerSheet
        open={cityOpen}
        onClose={() => setCityOpen(false)}
        cities={cities}
        selectedId={city.id}
        onSelect={setCity}
      />
    </div>
  );
}
