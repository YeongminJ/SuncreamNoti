import { EmojiBubble } from "./EmojiBubble";

interface Props {
  message?: string;
}

/**
 * 진입 시 토스 로그인 대기 동안 잠깐 노출되는 스플래시.
 * 부드러운 펄스 애니메이션으로 멈춤이 아니라 진행 중임을 전달.
 */
export function LoadingSplash({ message = "잠시만 기다려주세요" }: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 24,
        background: "#FFFDFA",
      }}
    >
      <div
        style={{
          animation: "sunalarm-splash-pulse 1.4s ease-in-out infinite",
        }}
      >
        <EmojiBubble size={88} background="#FFF3EC">
          🧴
        </EmojiBubble>
      </div>
      <div
        style={{
          fontSize: 14,
          color: "#94A3B8",
          fontWeight: 500,
        }}
      >
        {message}
      </div>
      <style>{`
        @keyframes sunalarm-splash-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
