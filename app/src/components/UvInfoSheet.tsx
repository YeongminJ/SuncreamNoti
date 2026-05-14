import { BottomSheet } from "@toss/tds-mobile";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Level {
  range: string;
  label: string;
  color: string;
  bg: string;
  action: string;
}

const LEVELS: Level[] = [
  {
    range: "0–2",
    label: "약함",
    color: "#15803D",
    bg: "#DCFCE7",
    action: "그래도 SPF 15+ 권장",
  },
  {
    range: "3–5",
    label: "보통",
    color: "#A16207",
    bg: "#FEF3C7",
    action: "SPF 30+ · 2~3시간마다 재도포",
  },
  {
    range: "6–7",
    label: "강함",
    color: "#C2410C",
    bg: "#FED7AA",
    action: "SPF 30+ · 그늘 · 모자",
  },
  {
    range: "8–10",
    label: "매우 강함",
    color: "#B91C1C",
    bg: "#FECACA",
    action: "SPF 50+ · 외출 자제 · 보호장구",
  },
  {
    range: "11+",
    label: "위험",
    color: "#7E22CE",
    bg: "#E9D5FF",
    action: "정오 외출 피하기 · 강한 보호 필수",
  },
];

/**
 * 자외선 지수가 어떤 의미인지 설명하는 BottomSheet.
 * - WHO 글로벌 UV 지수 기준의 5단계 분류
 * - 단계별 권장 행동 + 신뢰 출처 표기
 */
export function UvInfoSheet({ open, onClose }: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={<BottomSheet.Header>자외선 지수란?</BottomSheet.Header>}
      expandBottomSheet
      maxHeight={620}
    >
      <div
        style={{
          padding: "0 20px 24px",
          maxHeight: "70vh",
          overflowY: "auto",
          color: "#334155",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: "0 0 16px", color: "#475569" }}>
          자외선이 피부에 미치는 강도를 0부터 11+까지 숫자로 표시한 국제
          표준이에요. 숫자가 클수록 짧은 시간만 노출돼도 피부 손상 위험이
          커져요.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LEVELS.map((l) => (
            <div
              key={l.range}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: l.bg,
                borderRadius: 12,
              }}
            >
              <div style={{ minWidth: 60 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: l.color,
                    lineHeight: 1.1,
                  }}
                >
                  {l.range}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: l.color,
                    marginTop: 2,
                  }}
                >
                  {l.label}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: "#1F2937",
                  fontWeight: 500,
                }}
              >
                {l.action}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 20,
            padding: "14px 16px",
            background: "#F1F5F9",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#0F172A",
              marginBottom: 8,
            }}
          >
            출처
          </div>
          <ul
            style={{
              margin: 0,
              padding: "0 0 0 18px",
              color: "#475569",
              fontSize: 12,
              lineHeight: 1.7,
            }}
          >
            <li>
              <strong>WHO Global Solar UV Index</strong> — 단계 정의 (
              0~10+ 5단계)
            </li>
            <li>
              <strong>기상청(KMA)</strong> — 국내 자외선 예보 기준
            </li>
            <li>
              <strong>대한피부과학회</strong> — 일상 재도포 2~3시간 권고
            </li>
            <li>
              <strong>Open-Meteo</strong> — 본 앱이 실시간 UV 지수를 받아오는
              공개 기상 API
            </li>
          </ul>
        </div>

        <p
          style={{
            margin: "16px 0 0",
            fontSize: 12,
            color: "#94A3B8",
            lineHeight: 1.5,
          }}
        >
          지수는 위치·시간·구름 상태에 따라 변동돼요. 흐린 날에도 자외선의
          80%는 통과하니 외출 시 항상 자외선 차단을 권장해요.
        </p>
      </div>
    </BottomSheet>
  );
}
