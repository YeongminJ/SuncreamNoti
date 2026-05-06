import type { CSSProperties } from "react";

/**
 * 메인 CTA 버튼에 로고/카드와 동일한 따뜻한 오렌지 그라디언트를 적용해요.
 *
 * TDS Button의 `--button-background-color`는 단색 `background-color`로 들어가
 * 그라디언트가 안 먹기 때문에 `backgroundImage`로 덮어써요. transparent를 같이
 * 줘서 변수 fallback이 노출되지 않도록 합니다.
 *
 * 로고 그라디언트(`#FF9B3C → #FF7E2E → #E04E15`) 중 위 두 단계만 사용해
 * 너무 어두워지지 않게 조절했어요.
 */
export const CTA_GRADIENT_STYLE = {
  "--button-background-color": "transparent",
  backgroundImage: "linear-gradient(135deg, #FF9B3C 0%, #FF7E2E 100%)",
} as CSSProperties;
