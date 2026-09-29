import { requestNotificationAgreement } from "@apps-in-toss/web-framework";
import { getUserKey, setNotificationAgreement } from "./api";

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
 * newAgreement/alreadyAgreed 이벤트를 받으면 서버에도 `notification_agreed_at`을
 * 저장해요 — cron이 이 값을 보고 발송 대상을 결정하므로 반드시 동기화 필요.
 *
 * **SDK 요구**: `requestNotificationAgreement`는 @apps-in-toss/web-framework 2.5+.
 * 이 앱은 ^2.8을 사용하므로 직접 named import.
 *
 * **콘솔 등록 필요**: `VITE_NOTIFICATION_TEMPLATE_CODE`에 토스 콘솔에서
 * 발급된 알림 동의문 코드를 넣어야 동의 모달이 실제로 떠요.
 */

const AGREED_KEY = "sunalarm.notification.agreed.v1";
/**
 * 로컬에서 이미 동의됐다고 캐시되어 있지만 서버에도 반영됐는지 여부.
 * `notification_agreed_at` 컬럼 도입 이전부터 사용해오던 사용자를 위한 지연 동기화용.
 */
const AGREED_SERVER_SYNCED_KEY = "sunalarm.notification.agreed.serverSynced.v1";
const TEMPLATE_CODE = (
  import.meta.env.VITE_NOTIFICATION_TEMPLATE_CODE as string | undefined
)?.trim();

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

/**
 * 동의 성공 시 서버에도 시각 기록. 로컬 캐시를 먼저 세운 뒤 서버 호출은
 * fire-and-forget — 실패해도 다음 진입 시 재시도할 수 있도록 별도 락 없음.
 * userKey 조회가 실패하면 서버 호출은 스킵(다음 온라인 진입 때 다시 시도).
 * 성공 시 serverSynced 플래그를 남겨 재진입에서 중복 호출을 막아요.
 */
async function persistAgreementToServer(): Promise<void> {
  try {
    const userKey = await getUserKey();
    if (!userKey) return;
    const res = await setNotificationAgreement({ userKey, agreed: true });
    if (res.ok) {
      try {
        window.localStorage.setItem(AGREED_SERVER_SYNCED_KEY, "1");
      } catch {
        /* noop */
      }
    }
  } catch (err) {
    console.warn("[notif] persistAgreementToServer failed", err);
  }
}

function isServerSyncedLocally(): boolean {
  try {
    return window.localStorage.getItem(AGREED_SERVER_SYNCED_KEY) === "1";
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
  // 로컬 캐시가 잡히자마자 서버에도 반영 시도 (실패는 무시 — 다음 진입에 재시도).
  void persistAgreementToServer();
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
    // 서버 반영이 아직 안 된 옛 사용자면 지연 동기화. 캐시 플래그로 중복 방지.
    if (!isServerSyncedLocally()) {
      void persistAgreementToServer();
    }
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
