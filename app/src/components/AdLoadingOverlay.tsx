import { useMemo } from "react";

/**
 * 광고 로딩 중 전체 화면 오버레이.
 *
 * `useRewardedAd().state === "loading"`일 때 부모에서 렌더링.
 * 720p mp4 영상 + 선크림 한 줄 팁으로 대기 시간을 채워요. `showing` 상태로 넘어가면
 * 토스 SDK가 자체 광고 UI를 띄우므로 오버레이는 사라져야 해요.
 *
 * mp4 사용 이유:
 * - GIF 대비 1/20 사이즈로 같은 화질 표현 가능 (720p 597KB vs GIF 14MB)
 * - autoplay/loop/muted/playsinline 조합으로 토스 WebView에서 안정 재생
 */

const SUNSCREEN_TIPS: { title: string; body: string }[] = [
  {
    title: "정량은 손가락 두 마디",
    body: "얇게 바르면 SPF 효과가 절반 이하로 떨어져요. 500원 동전 크기를 두세 번 나눠 발라요.",
  },
  {
    title: "흐린 날·실내도 UVA는 그대로",
    body: "UVA는 구름과 유리창을 그대로 통과해요. 창가 자리라면 실내에서도 꼭 발라요.",
  },
  {
    title: "유기자차는 외출 20분 전",
    body: "화학적 차단제는 흡수돼야 효과가 나와요. 무기자차는 바른 즉시 차단돼요.",
  },
  {
    title: "민감성 피부는 무기자차",
    body: "자극이 적어 트러블·아기 피부에 안전해요. 건성·일반 피부는 유기자차가 발림성이 좋아요.",
  },
  {
    title: "2~3시간마다 덧발라야 해요",
    body: "야외에선 땀·유분에 지워져요. 메이크업 위엔 선스틱·선쿠션·선스프레이가 실용적이에요.",
  },
  {
    title: "이중 세안은 필수",
    body: "폼클렌징만으론 선크림 막이 안 지워져요. 클렌징 오일·밀크로 1차 세안 후 폼클렌징으로 마무리해요.",
  },
  {
    title: "백탁이 싫다면 얇게 여러 번",
    body: "한 번에 두껍게 바르면 밀려요. 얇게 두세 번 레이어링하면서 흡수시키는 게 꿀팁이에요.",
  },
  {
    title: "UVB는 화상, UVA는 노화",
    body: "SPF는 UVB, PA는 UVA 차단 지수예요. 둘 다 표기된 제품을 골라야 노화·기미를 막을 수 있어요.",
  },
];

export function AdLoadingOverlay({ open }: { open: boolean }) {
  const tip = useMemo(
    () => SUNSCREEN_TIPS[Math.floor(Math.random() * SUNSCREEN_TIPS.length)],
    [open],
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.72)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
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
          width: "min(64vw, 280px)",
          height: "auto",
          borderRadius: 16,
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.3)",
        }}
      />
      <p
        style={{
          margin: 0,
          color: "rgba(255, 255, 255, 0.72)",
          fontSize: 13,
          fontWeight: 500,
          textAlign: "center",
          letterSpacing: "-0.1px",
        }}
      >
        광고를 준비하고 있어요…
      </p>
      <div
        style={{
          width: "min(88vw, 360px)",
          background: "rgba(255, 255, 255, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 16,
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#FFD166",
              letterSpacing: "0.3px",
            }}
          >
            TIP
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.2px",
            }}
          >
            {tip.title}
          </span>
        </div>
        <p
          style={{
            margin: 0,
            color: "rgba(255, 255, 255, 0.82)",
            fontSize: 14,
            lineHeight: 1.55,
            letterSpacing: "-0.1px",
          }}
        >
          {tip.body}
        </p>
      </div>
    </div>
  );
}
