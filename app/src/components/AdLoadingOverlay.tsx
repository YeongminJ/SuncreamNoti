/**
 * 광고 로딩 중 전체 화면 오버레이.
 *
 * `useRewardedAd().state === "loading"`일 때 부모에서 렌더링.
 * 720p mp4 영상으로 시각적 피드백 + 안내 텍스트 노출. `showing` 상태로 넘어가면
 * 토스 SDK가 자체 광고 UI를 띄우므로 오버레이는 사라져야 해요.
 *
 * mp4 사용 이유:
 * - GIF 대비 1/20 사이즈로 같은 화질 표현 가능 (720p 597KB vs GIF 14MB)
 * - autoplay/loop/muted/playsinline 조합으로 토스 WebView에서 안정 재생
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
      <video
        src="/ad-loading.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        style={{
          width: "min(80vw, 360px)",
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
