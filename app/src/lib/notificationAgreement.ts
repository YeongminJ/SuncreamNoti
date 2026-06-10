import * as appsInTossSdk from "@apps-in-toss/web-framework";

/**
 * 토스 알림 동의 게이팅 헬퍼.
 *
 * 광고 시청 같은 사용자 트리거 액션 직전에 호출해, 동의 안 된 사용자에게만
 * 토스 표준 동의 모달을 띄우고, 동의된 사용자는 즉시 콜백을 실행해요.
 *
 * - 이미 동의됨: `onAgreed` 즉시 호출.
 * - 미동의 + SDK 지원 + templateCode 설정: 토스 SDK 모달 → 결과별 콜백.
 * - SDK 미지원 (웹 dev) 또는 templateCode 미설정: `onAgreed` 즉시 호출 (안전망).
 *
 * 동의 결과는 localStorage 미러링 — 토스 SDK 자체도 alreadyAgreed를 반환하지만
 * 매번 SDK 호출 비용을 줄이려고 클라 단에서 한 번 더 캐싱해요.
 *
 * **SDK 버전 주의**: `requestNotificationAgreement` 는 @apps-in-toss/web-framework
 * 2.5+ 에 추가된 API. 현재 설치 버전(2.4.x)에는 export가 없어서 namespace import 후
 * 동적 조회로 안전망 처리. SDK 업그레이드 시 자동으로 함수가 살아나요.
 *
 * **콘솔 등록 필요**: `VITE_NOTIFICATION_TEMPLATE_CODE`에 토스 콘솔에서
 * 발급된 알림 동의문 코드를 넣어야 동의 모달이 실제로 떠요.
 */

const AGREED_KEY = "sunalarm.notification.agreed.v1";
const TEMPLATE_CODE = (
  import.meta.env.VITE_NOTIFICATION_TEMPLATE_CODE as string | undefined
)?.trim();

type NotificationAgreementResult =
  | "newAgreement"
  | "alreadyAgreed"
  | "agreementRejected";

type RequestNotificationAgreementParams = {
  options: { templateCode: string };
  onEvent: (result: { type: NotificationAgreementResult }) => void;
  onError: (err: unknown) => void | Promise<void>;
};

type RequestNotificationAgreementFn = ((
  params: RequestNotificationAgreementParams,
) => () => void) & {
  isSupported?: () => boolean;
};

// SDK 2.4.x에는 export가 없을 수 있어 런타임 동적 조회. 2.5+에선 정상 함수.
const requestNotificationAgreement = (
  appsInTossSdk as unknown as Record<string, unknown>
).requestNotificationAgreement as RequestNotificationAgreementFn | undefined;

function safeIsSupported(
  fn: { isSupported?: () => boolean } | undefined,
): boolean {
  if (!fn || typeof fn.isSupported !== "function") return false;
  try {
    return fn.isSupported();
  } catch {
    return false;
  }
}

export function hasAgreedToNotifications(): boolean {
  try {
    return window.localStorage.getItem(AGREED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * templateCode가 설정돼 있는지 — 즉 동의 게이팅이 실제로 동작하는지.
 *
 * UI 라벨 분기 조건. false면 광고 CTA가 종전 그대로(게이팅 텍스트 없이) 표시되고,
 * true면 미동의 사용자에게 "알림 받고…" 같은 결합 문구를 노출해요.
 */
export function isAgreementGatingEnabled(): boolean {
  return Boolean(TEMPLATE_CODE);
}

function markAgreed(): void {
  try {
    window.localStorage.setItem(AGREED_KEY, "1");
  } catch {
    /* noop */
  }
}

export type AgreementOutcome =
  | "alreadyAgreedLocal" // localStorage 캐시 hit
  | "newAgreement"
  | "alreadyAgreed"
  | "agreementRejected"
  | "skippedNoSdk" // SDK 미지원 (dev/웹) — 안전망 통과
  | "skippedNoTemplate" // templateCode 미설정 — 안전망 통과
  | "errored"; // SDK 에러 — 안전망 통과

/**
 * 알림 동의 보장 후 onAgreed 실행. 거부 시 onCancel.
 *
 * onOutcome은 트래킹용 콜백 — 모든 분기(통과/거부/스킵)에서 한 번 호출돼요.
 * 사용자 액션을 차단하지 않는 게 우선이라, SDK 에러나 미지원 환경에선
 * 일단 통과시켜요. (markAgreed는 명시적 동의일 때만 호출 — 다음 진입에서 재시도)
 */
export function ensureAgreedThen(opts: {
  onAgreed: () => void;
  onCancel?: () => void;
  onOutcome?: (outcome: AgreementOutcome) => void;
}): void {
  const { onAgreed, onCancel, onOutcome } = opts;

  if (hasAgreedToNotifications()) {
    onOutcome?.("alreadyAgreedLocal");
    onAgreed();
    return;
  }

  if (!TEMPLATE_CODE) {
    if (import.meta.env.DEV) {
      console.debug(
        "[notif] VITE_NOTIFICATION_TEMPLATE_CODE not set — skipping consent",
      );
    } else {
      console.warn("[notif] templateCode missing in prod — proceeding anyway");
    }
    onOutcome?.("skippedNoTemplate");
    onAgreed();
    return;
  }

  if (
    typeof requestNotificationAgreement !== "function" ||
    !safeIsSupported(requestNotificationAgreement)
  ) {
    console.debug(
      "[notif] requestNotificationAgreement unavailable in this SDK build",
    );
    onOutcome?.("skippedNoSdk");
    onAgreed();
    return;
  }

  // SDK 호출. cleanup은 onEvent/onError 중 어느 쪽이 와도 1회만 부르도록.
  let cleanup: (() => void) | null = null;
  let settled = false;
  const settleWith = (outcome: AgreementOutcome) => {
    if (settled) return;
    settled = true;
    try {
      cleanup?.();
    } catch {
      /* noop */
    }
    cleanup = null;
    onOutcome?.(outcome);
    if (outcome === "newAgreement" || outcome === "alreadyAgreed") {
      markAgreed();
      onAgreed();
    } else if (outcome === "agreementRejected") {
      onCancel?.();
    } else {
      // skipped / errored → 안전망 통과
      onAgreed();
    }
  };

  try {
    cleanup = requestNotificationAgreement({
      options: { templateCode: TEMPLATE_CODE },
      onEvent: ({ type }) => {
        if (type === "newAgreement") settleWith("newAgreement");
        else if (type === "alreadyAgreed") settleWith("alreadyAgreed");
        else if (type === "agreementRejected") settleWith("agreementRejected");
      },
      onError: (err) => {
        console.warn("[notif] requestNotificationAgreement error", err);
        settleWith("errored");
      },
    });
  } catch (err) {
    console.warn("[notif] requestNotificationAgreement threw", err);
    settleWith("errored");
  }
}
