import { clearAllSunalarmKeys } from "../lib/storage";

/**
 * Dev 환경 전용 초기화 버튼.
 * 우측 하단에 떠 있고, 누르면 모든 `sunalarm.*` localStorage 키를 지우고 새로고침해요.
 * 프로덕션 빌드(`import.meta.env.DEV === false`)에서는 렌더링되지 않아요.
 */
export function DevResetButton() {
  if (!import.meta.env.DEV) return null;

  const onClick = () => {
    if (!window.confirm("모든 저장 데이터를 초기화할까요?")) return;
    const removed = clearAllSunalarmKeys();
    console.log("[reset] cleared", removed, "keys");
    window.location.reload();
  };

  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.7)",
        color: "#fff",
        fontSize: 11,
        padding: "6px 10px",
        borderRadius: 14,
        border: 0,
        cursor: "pointer",
      }}
      aria-label="Dev: 데이터 초기화"
    >
      🛠 reset
    </button>
  );
}
