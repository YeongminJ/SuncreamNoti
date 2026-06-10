import { Button, Top } from "@toss/tds-mobile";
import { useEffect, useMemo, useState } from "react";
import { AdLoadingOverlay } from "../components/AdLoadingOverlay";
import { AuthFailedBanner } from "../components/AuthFailedBanner";
import { BannerAdSlot } from "../components/BannerAdSlot";
import { EmojiBubble } from "../components/EmojiBubble";
import { SettingsSheet } from "../components/SettingsSheet";
import { UvIndicator } from "../components/UvIndicator";
import { useRewardedAd } from "../hooks/useRewardedAd";
import { getUserKey, setNotificationsDisabled } from "../lib/api";
import { CTA_GRADIENT_STYLE } from "../lib/buttonStyle";
import {
  ensureAgreedThen,
  hasAgreedToNotifications,
  isAgreementGatingEnabled,
} from "../lib/notificationAgreement";
import {
  MIN_REDEEM_AMOUNT,
  PROMOTION_ENABLED,
  redeemToTossPoints,
} from "../lib/promotion";
import {
  AD_BONUS_MAX_PER_SLOT,
  adBonusRewardFor,
  formatHm,
  nowMinuteOfDay,
} from "../lib/recommendation";
import { trackClick, trackScreen } from "../lib/track";
import { useAppStore } from "../store/useAppStore";
import {
  BOOST_MULTIPLIER,
  completedSlotCount,
  isBoostDay,
  nextOpenSlotIndex,
  redeemableAmount,
  slotStatus,
  totalEarnedToday,
  useDayStore,
  type SlotRecord,
} from "../store/useDayStore";
import { useProfileStore } from "../store/useProfileStore";

export function HomeScreen() {
  const goToResult = useAppStore((s) => s.goToResult);
  const profile = useProfileStore((s) => s.profile);
  const slotsForToday = useProfileStore((s) => s.slotsForToday);
  const ensureToday = useDayStore((s) => s.ensureToday);
  const day = useDayStore((s) => s.day);
  const totals = useDayStore((s) => s.totals);
  const applySlot = useDayStore((s) => s.applySlot);
  const markRedeemed = useDayStore((s) => s.markRedeemed);

  // 진입 즉시 보상형 광고 미리 로드 — CTA 클릭 시 대기 없이 바로 노출.
  const ad = useRewardedAd();

  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // 알림 켜기/끄기 상태 — localStorage 미러링.
  // 서버 sync는 토글 시 fire-and-forget, 실패 시 롤백.
  // 토스 정책상 "수신 해제 기능" 요건 충족용 진입로.
  const NOTIFICATIONS_DISABLED_KEY = "sunalarm.notifications.disabled.v1";
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsDisabled, setNotificationsDisabledLocal] = useState(() => {
    try {
      return window.localStorage.getItem(NOTIFICATIONS_DISABLED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  // 동의 게이팅 활성 여부 + 사용자가 이미 동의했는지.
  // gatingEnabled가 false면(=templateCode 미설정) 종전 동작과 동일.
  // hasAgreed는 CTA 라벨 분기에 쓰이고, ensureAgreedThen의 onOutcome으로 갱신.
  const gatingEnabled = isAgreementGatingEnabled();
  const [hasAgreed, setHasAgreed] = useState(() => hasAgreedToNotifications());

  // 1분마다 강제 리렌더 — 카운트다운 갱신
  const [now, setNow] = useState(() => nowMinuteOfDay());
  useEffect(() => {
    const id = setInterval(() => setNow(nowMinuteOfDay()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // 오늘 슬롯 보장 (프로필 변경 시에도 동기화)
  useEffect(() => {
    if (!profile) return;
    const slots = slotsForToday();
    if (slots.length > 0) ensureToday(slots);
  }, [profile, slotsForToday, ensureToday]);

  useEffect(() => {
    trackScreen("screen_home", {
      streak: totals.streak,
      lifetime: totals.lifetimeReward,
      done: completedSlotCount(day),
      total_today: totalEarnedToday(day),
      access_count: totals.accessCount,
      boost_active: isBoostDay(totals),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextIdx = useMemo(() => nextOpenSlotIndex(day, now), [day, now]);
  const nextSlot = nextIdx >= 0 ? day?.slots[nextIdx] : undefined;
  const boostActive = isBoostDay(totals);
  // "다음 회차에 받을" 미리보기 금액 = 현재까지 완료된 슬롯 수 + 1.
  // applySlot 시점에 baseReward가 동적으로 정해지므로 미리 계산해서 카드에 표시.
  // 부스트 데이엔 2배로 표시 — applySlot 내부와 동일하게 곱해서 표시값과 실제값이 일치.
  const nextBaseReward = boostActive
    ? (completedSlotCount(day) + 1) * BOOST_MULTIPLIER
    : completedSlotCount(day) + 1;

  const isUnlocked = nextSlot != null && now >= nextSlot.targetMinute;
  const minutesUntilNext =
    nextSlot != null ? Math.max(0, nextSlot.targetMinute - now) : 0;

  // CTA 클릭 → (필요 시 알림 동의) → 광고 노출 → 보상 시 슬롯 적립 + 결과 화면 이동.
  //
  // 동의 게이팅: templateCode가 설정돼 있고 미동의 사용자면 토스 동의 모달 먼저.
  // 동의 거부 시 아무 동작 안 함. env가 비어있으면 ensureAgreedThen이 즉시 통과시키니
  // 종전과 동일하게 광고만 재생.
  const handleApply = () => {
    if (!day || nextIdx < 0 || !isUnlocked) return;
    if (!ad.supported && !import.meta.env.DEV) return;
    trackClick("press_apply", {
      slot_index: nextIdx,
      ad_state: ad.state,
      boost_active: boostActive,
      gating_enabled: gatingEnabled,
      had_agreed: hasAgreed,
    });
    ensureAgreedThen({
      onOutcome: (outcome) => {
        trackClick("ad_consent_outcome", {
          phase: "apply_primary",
          outcome,
          slot_index: nextIdx,
        });
        if (outcome === "newAgreement" || outcome === "alreadyAgreed") {
          setHasAgreed(true);
        }
      },
      onAgreed: () => {
        ad.show(
          () => {
            applySlot(nextIdx);
            goToResult(nextIdx);
          },
          () => {
            // 광고 시청 미완료 — 그대로 home에 머무름. 사용자는 다시 시도 가능.
            console.warn("[home] primary reward not earned");
          },
        );
      },
      onCancel: () => {
        // 동의 거부 — 사용자 요청대로 아무 동작도 안 함.
        // 광고 재생도, 적립도, 화면 이동도 없음.
        console.debug("[home] consent rejected — no-op");
      },
    });
  };

  // 토글 핸들러: 낙관적 업데이트 + 서버 sync. 실패 시 로컬·UI 모두 복원.
  const handleToggleNotifications = (enabled: boolean) => {
    if (notifBusy) return;
    const newDisabled = !enabled;
    trackClick("press_toggle_notifications", { disabled: newDisabled });
    setNotificationsDisabledLocal(newDisabled);
    setNotifError(null);
    try {
      window.localStorage.setItem(
        NOTIFICATIONS_DISABLED_KEY,
        newDisabled ? "1" : "0",
      );
    } catch {
      // localStorage 실패는 무시 — 다음 진입 시 서버 상태 기준으로 재동기화 필요할 수 있음.
    }
    setNotifBusy(true);
    void (async () => {
      const userKey = await getUserKey();
      if (!userKey) {
        setNotifBusy(false);
        setNotifError("사용자 정보를 불러올 수 없어요.");
        // 로컬 롤백
        setNotificationsDisabledLocal((prev) => !prev);
        try {
          window.localStorage.setItem(
            NOTIFICATIONS_DISABLED_KEY,
            !newDisabled ? "1" : "0",
          );
        } catch {
          /* noop */
        }
        return;
      }
      const res = await setNotificationsDisabled({
        userKey,
        disabled: newDisabled,
      });
      setNotifBusy(false);
      if (!res.ok) {
        setNotifError("잠시 후 다시 시도해 주세요.");
        // 로컬 롤백
        setNotificationsDisabledLocal((prev) => !prev);
        try {
          window.localStorage.setItem(
            NOTIFICATIONS_DISABLED_KEY,
            !newDisabled ? "1" : "0",
          );
        } catch {
          /* noop */
        }
      }
    })();
  };

  const redeemable = redeemableAmount(totals);
  const canRedeem = redeemable >= MIN_REDEEM_AMOUNT;
  const handleRedeem = async () => {
    if (redeeming || !canRedeem) return;
    trackClick("press_redeem_toss_points", { amount: redeemable });
    setRedeeming(true);
    setRedeemError(null);
    const res = await redeemToTossPoints(redeemable);
    setRedeeming(false);
    if (res.ok) {
      markRedeemed(redeemable);
    } else {
      setRedeemError(res.message);
    }
  };

  if (!day) {
    return (
      <div style={{ padding: 24 }}>
        <p>오늘의 일정을 준비하고 있어요…</p>
      </div>
    );
  }

  const allDone = nextIdx < 0;
  const adBusy = ad.state === "showing" || ad.state === "loading";
  // 동의 게이팅이 활성이고 미동의 상태면 CTA 라벨에 동의 유도 문구 결합.
  const needsConsentLabel = gatingEnabled && !hasAgreed;
  const ctaLabel = (() => {
    if (allDone) return "오늘 다 발랐어요 ✨";
    if (!isUnlocked) return `${formatRemaining(minutesUntilNext)} 남았어요`;
    if (ad.state === "loading") return "광고 준비 중…";
    if (ad.state === "showing") return "광고 보는 중…";
    if (!ad.supported) return "광고 미지원 환경";
    if (needsConsentLabel) return "알림 받고 광고 보고 적립하기";
    return "광고 보고 피부 보호하기";
  })();

  return (
    <div style={{ paddingBottom: 140 }}>
      <AdLoadingOverlay open={ad.state === "loading"} />
      <Top
        title={
          <Top.TitleParagraph size={28}>
            오늘 {completedSlotCount(day)}/{day.slots.length}회 발랐어요
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            오늘 적립 {totalEarnedToday(day)}원 · 누적{" "}
            {totals.lifetimeReward}원
          </Top.SubtitleParagraph>
        }
        right={
          <button
            onClick={() => {
              trackClick("press_open_settings");
              setSettingsOpen(true);
            }}
            aria-label="설정"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: "#F8FAFC",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              WebkitTapHighlightColor: "transparent",
              padding: 0,
            }}
          >
            ⚙️
          </button>
        }
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        notificationsEnabled={!notificationsDisabled}
        onToggleNotifications={handleToggleNotifications}
        busy={notifBusy}
        errorMessage={notifError}
      />

      <AuthFailedBanner />

      {boostActive && (
        <div style={{ padding: "8px 24px 0" }}>
          <div
            style={{
              borderRadius: 14,
              padding: "14px 16px",
              background:
                "linear-gradient(135deg, #FF6B6B 0%, #FF9B3C 50%, #FFC93C 100%)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 4px 14px rgba(255, 107, 107, 0.25)",
            }}
          >
            <span style={{ fontSize: 22 }}>🚀</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>
                오늘 부스트 모드!
              </div>
              <div
                style={{ fontSize: 12, marginTop: 2, opacity: 0.92 }}
              >
                모든 적립이 {BOOST_MULTIPLIER}배 — 3일에 한 번 찾아와요
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "8px 24px 24px" }}>
        <NextCard
          allDone={allDone}
          isUnlocked={isUnlocked}
          minutesUntilNext={minutesUntilNext}
          nextSlot={nextSlot}
          slotIndex={nextIdx}
          baseReward={nextBaseReward}
        />

        {PROMOTION_ENABLED && redeemable > 0 && (
          <RedeemCard
            amount={redeemable}
            canRedeem={canRedeem}
            loading={redeeming}
            errorMessage={redeemError}
            onRedeem={handleRedeem}
          />
        )}

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            margin: "24px 0 12px",
            gap: 8,
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#0F172A",
              margin: 0,
            }}
          >
            오늘의 권장 시간
          </h3>
          <span style={{ fontSize: 12, color: "#FF7E2E", fontWeight: 600 }}>
            바를수록 단가 ↑
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {day.slots.map((slot, i) => (
            <SlotRow
              key={i}
              index={i}
              slot={slot}
              status={slotStatus(day, i, now)}
              isCurrent={i === nextIdx}
            />
          ))}
        </div>

        <UvIndicator />
        <BannerAdSlot />
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 24px 28px",
          background: "linear-gradient(to top, #fff 60%, transparent)",
        }}
      >
        <Button
          size="xlarge"
          display="block"
          onClick={handleApply}
          disabled={
            !isUnlocked ||
            allDone ||
            adBusy ||
            (!ad.supported && !import.meta.env.DEV)
          }
          loading={adBusy}
          style={CTA_GRADIENT_STYLE}
        >
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}

function NextCard({
  allDone,
  isUnlocked,
  minutesUntilNext,
  nextSlot,
  slotIndex,
  baseReward,
}: {
  allDone: boolean;
  isUnlocked: boolean;
  minutesUntilNext: number;
  nextSlot?: SlotRecord;
  slotIndex: number;
  /** 이번 슬롯을 발랐을 때 받게 될 base 금액 (완료 순서 + 1). */
  baseReward: number;
}) {
  if (allDone) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #FF9B3C 0%, #FF7E2E 100%)",
          color: "#fff",
          borderRadius: 20,
          padding: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
          오늘의 미션
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
          전부 끝났어요! 👏
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>
          내일 또 만나요
        </div>
        <div style={{ position: "absolute", top: 16, right: 16 }}>
          <EmojiBubble size={56} background="rgba(255,255,255,0.22)">
            ✨
          </EmojiBubble>
        </div>
      </div>
    );
  }
  if (!nextSlot) return null;

  return (
    <div
      style={{
        background: isUnlocked
          ? "linear-gradient(135deg, #FF9B3C 0%, #FF7E2E 100%)"
          : "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
        color: isUnlocked ? "#fff" : "#0F172A",
        borderRadius: 20,
        padding: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: 13,
          opacity: 0.85,
          marginBottom: 6,
        }}
      >
        {slotIndex + 1}번째 발림 · 예정 {formatHm(nextSlot.targetMinute)}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
        {isUnlocked
          ? "지금 발라주세요!"
          : `${formatRemaining(minutesUntilNext)} 후`}
      </div>
      <div
        style={{
          fontSize: 13,
          opacity: 0.85,
          marginTop: 8,
        }}
      >
        광고 보면 {baseReward}원
        {AD_BONUS_MAX_PER_SLOT > 0 ? (
          <>
            {" → "}
            {Array.from({ length: AD_BONUS_MAX_PER_SLOT }, (_, i) =>
              adBonusRewardFor(baseReward, i + 1),
            ).join("원 → ")}
            원까지 누진 ↑
          </>
        ) : null}
      </div>
      <div style={{ position: "absolute", top: 16, right: 16 }}>
        <EmojiBubble
          size={56}
          background={isUnlocked ? "rgba(255,255,255,0.22)" : "#FFE7D6"}
        >
          {isUnlocked ? "☀️" : "🧴"}
        </EmojiBubble>
      </div>
    </div>
  );
}

function RedeemCard({
  amount,
  canRedeem,
  loading,
  errorMessage,
  onRedeem,
}: {
  amount: number;
  canRedeem: boolean;
  loading: boolean;
  errorMessage: string | null;
  onRedeem: () => void;
}) {
  const remaining = Math.max(0, MIN_REDEEM_AMOUNT - amount);
  const progress = Math.min(1, amount / MIN_REDEEM_AMOUNT);

  return (
    <div
      style={{
        marginTop: 16,
        background: canRedeem ? "#F0FDF4" : "#F8FAFC",
        border: `1px solid ${canRedeem ? "#BBF7D0" : "#E2E8F0"}`,
        borderRadius: 16,
        padding: 18,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <EmojiBubble size={44} background="#FFFFFF">
        💰
      </EmojiBubble>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#0F172A",
            marginBottom: 4,
          }}
        >
          토스 포인트로 받기
        </div>
        {canRedeem ? (
          <div style={{ fontSize: 13, color: "#16A34A", fontWeight: 600 }}>
            {amount}원 교환 가능
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 12,
                color: "#64748B",
                marginBottom: 6,
              }}
            >
              {remaining}원 더 모으면 받을 수 있어요 ({amount}/
              {MIN_REDEEM_AMOUNT}원)
            </div>
            <div
              style={{
                height: 4,
                background: "#E2E8F0",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress * 100}%`,
                  height: "100%",
                  background: "#FF9B3C",
                  transition: "width 240ms ease",
                }}
              />
            </div>
          </>
        )}
        {errorMessage && (
          <div style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>
            {errorMessage}
          </div>
        )}
      </div>
      <Button
        size="small"
        color="primary"
        onClick={onRedeem}
        loading={loading}
        disabled={loading || !canRedeem}
      >
        받기
      </Button>
    </div>
  );
}

function SlotRow({
  index,
  slot,
  status,
  isCurrent,
}: {
  index: number;
  slot: SlotRecord;
  status: "applied" | "active" | "expired" | "upcoming";
  isCurrent: boolean;
}) {
  const done = status === "applied";
  const expired = status === "expired";
  const earned = done ? slot.baseReward + slot.adBonusReward : 0;

  let statusText: string;
  let statusColor: string;
  if (done) {
    statusText = `+${earned}원`;
    statusColor = "#10B981";
  } else if (expired) {
    statusText = "놓침";
    statusColor = "#94A3B8";
  } else if (isCurrent) {
    statusText = status === "active" ? "지금" : "대기 중";
    statusColor = "#FF9B3C";
  } else {
    statusText = "잠김";
    statusColor = "#94A3B8";
  }

  const slotEmoji = done ? "✅" : isCurrent ? "☀️" : expired ? "💤" : "🧴";
  const slotEmojiBg = done
    ? "#DCFCE7"
    : isCurrent
      ? "#FFE7D6"
      : "#E2E8F0";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        background: done
          ? "#F0FDF4"
          : isCurrent
            ? "#FFF3EC"
            : expired
              ? "#F1F5F9"
              : "#F8FAFC",
        borderRadius: 14,
        border: `1px solid ${done ? "#BBF7D0" : isCurrent ? "#FFD9C2" : "transparent"}`,
        gap: 12,
        opacity: expired ? 0.65 : 1,
      }}
    >
      <EmojiBubble size={40} background={slotEmojiBg}>
        {slotEmoji}
      </EmojiBubble>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            color: "#64748B",
            marginBottom: 2,
          }}
        >
          {index + 1}번째
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#0F172A" }}>
          {formatHm(slot.targetMinute)}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: statusColor,
          }}
        >
          {statusText}
        </div>
        {done && (
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
            기본 {slot.baseReward}원
          </div>
        )}
      </div>
    </div>
  );
}

function formatRemaining(min: number): string {
  if (min <= 0) return "곧";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}
