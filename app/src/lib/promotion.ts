import { grantPromotionReward } from "@apps-in-toss/web-framework";

/**
 * 토스 포인트 프로모션 코드.
 *
 * - 콘솔 → 마케팅 → 프로모션(토스 포인트)에서 비게임용 프로모션을 등록한 뒤
 *   발급된 코드를 `PROD_PROMOTION_CODE`에 넣어주세요.
 * - dev / 프로모션 코드 미설정 시에는 자동으로 시뮬레이션 모드로 동작해요.
 *
 * 가이드: https://developers-apps-in-toss.toss.im/promotion/develop.md
 */
const PROD_PROMOTION_CODE: string = "01KQXNKS1CZSRNJJDF3S96S9BS";

/** 토스 포인트 교환 최소 금액(원). 잔돈 단위 호출을 막아 운영비용을 줄여요. */
export const MIN_REDEEM_AMOUNT = 10;

/**
 * 토스 포인트 교환 기능 활성화 여부.
 *
 * 프로모션 코드가 비어 있거나 dev 빌드면 false → UI에서 RedeemCard 자체를 숨겨요.
 * 콘솔에서 프로모션 등록·승인 후 `PROD_PROMOTION_CODE`를 채우면 자동으로 활성화돼요.
 *
 * 미설정 상태로 prod 출시되면 시뮬레이션 응답이 사용자에게 노출되어 "받기"를
 * 눌러도 실제 포인트가 안 들어가는 사고가 발생할 수 있으므로 반드시 이 가드 사용.
 */
export const PROMOTION_ENABLED =
  PROD_PROMOTION_CODE !== "" && !import.meta.env.DEV;

export type RedeemResult =
  | { ok: true; key: string; simulated?: boolean }
  | { ok: false; errorCode: string; message: string };

/**
 * 적립금을 토스 포인트로 지급. 성공 시 `key`(리워드 키) 반환.
 * 1회 지급 한도·승인 상태 등은 콘솔에서 관리되므로 호출부는 결과만 반영하면 돼요.
 */
export async function redeemToTossPoints(
  amount: number,
): Promise<RedeemResult> {
  if (amount < MIN_REDEEM_AMOUNT) {
    return {
      ok: false,
      errorCode: "BELOW_MIN",
      message: `${MIN_REDEEM_AMOUNT}원부터 교환할 수 있어요.`,
    };
  }

  if (
    !PROD_PROMOTION_CODE ||
    import.meta.env.DEV ||
    typeof grantPromotionReward !== "function"
  ) {
    if (import.meta.env.DEV) {
      console.debug("[promotion] simulating grant", { amount });
    }
    await new Promise((r) => setTimeout(r, 600));
    return {
      ok: true,
      key: `dev-${Date.now()}`,
      simulated: true,
    };
  }

  try {
    const result = await grantPromotionReward({
      params: { promotionCode: PROD_PROMOTION_CODE, amount },
    });

    if (!result || result === "ERROR") {
      return {
        ok: false,
        errorCode: "ERROR",
        message: "토스 앱에서 다시 시도해주세요.",
      };
    }
    if ("key" in result) {
      return { ok: true, key: result.key };
    }
    if ("errorCode" in result) {
      return {
        ok: false,
        errorCode: result.errorCode,
        message: result.message ?? "지급에 실패했어요.",
      };
    }
    return {
      ok: false,
      errorCode: "UNKNOWN",
      message: "알 수 없는 응답이에요.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[promotion] grant failed", msg);
    return { ok: false, errorCode: "THROWN", message: msg };
  }
}
