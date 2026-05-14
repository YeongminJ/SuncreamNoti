/**
 * 광고 로딩 중 전체 화면 오버레이.
 *
 * `useRewardedAd().state === "loading"`일 때 부모에서 렌더링.
 * GIF로 시각적 피드백 + 안내 텍스트 노출. `showing` 상태로 넘어가면
 * 토스 SDK가 자체 광고 UI를 띄우므로 오버레이는 사라져야 해요.
 */
export function AdLoadingOverlay({ open }: { open: boolean }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
      }}
      role="status"
      aria-live="polite"
      aria-label="광고를 불러오는 중"
    >
      <img
        src="/ad-loading.gif"
        alt=""
        style={{
          width: "min(80vw, 320px)",
          height: "auto",
          borderRadius: 16,
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.3)",
        }}
      />
      <p
        style={{
          margin: 0,
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        광고를 준비하고 있어요…
      </p>
    </div>
  );
}
