import { Button, Top } from "@toss/tds-mobile";
import { useEffect } from "react";
import { EmojiBubble } from "../components/EmojiBubble";
import { useRewardedAd } from "../hooks/useRewardedAd";
import { CTA_GRADIENT_STYLE } from "../lib/buttonStyle";
import {
  AD_BONUS_MAX_PER_SLOT,
  AD_BONUS_PER_VIEW,
} from "../lib/recommendation";
import { trackClick, trackScreen } from "../lib/track";
import { useAppStore } from "../store/useAppStore";
import { useDayStore } from "../store/useDayStore";

/**
 * 결과(적립 완료) + 보너스 광고 화면.
 *
 * - 첫 광고 시청은 [HomeScreen](./HomeScreen.tsx) CTA에서 즉시 처리되고,
 *   적립이 끝난 직후에 이 화면으로 이동해와요. 즉 진입 시점엔 항상 `applied=true`.
 * - 추가 광고 시청: +1원 보너스 (회차당 최대 `AD_BONUS_MAX_PER_SLOT`회).
 * - 안전장치로 `applied=false`로 직접 진입한 케이스에 대해서만 fallback CTA 노출.
 */
export function ApplyResultScreen() {
  const slotIndex = useAppStore((s) => s.resultSlotIndex);
  const navigate = useAppStore((s) => s.navigate);
  const day = useDayStore((s) => s.day);
  const applySlot = useDayStore((s) => s.applySlot);
  const addAdBonus = useDayStore((s) => s.addAdBonus);
  const ad = useRewardedAd();

  const slot = day?.slots[slotIndex];
  const applied = slot?.appliedAt != null;

  useEffect(() => {
    if (slotIndex < 0) return;
    trackScreen("screen_apply_result", {
      slot_index: slotIndex,
      already_applied: applied,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!slot) {
    return (
      <div style={{ padding: 24 }}>
        <p>결과를 불러올 수 없어요.</p>
        <Button onClick={() => navigate("home")}>홈으로</Button>
      </div>
    );
  }

  const adBonusLeft = Math.max(0, AD_BONUS_MAX_PER_SLOT - slot.adBonusCount);
  const totalThisSlot = applied ? slot.baseReward + slot.adBonusReward : 0;

  const watchPrimaryAd = () => {
    trackClick("press_watch_primary_ad", { slot_index: slotIndex });
    ad.show(
      () => applySlot(slotIndex),
      () => console.warn("[ad] primary reward not earned"),
    );
  };

  const watchBonusAd = () => {
    trackClick("press_watch_bonus_ad", { slot_index: slotIndex });
    ad.show(
      () => addAdBonus(slotIndex),
      () => console.warn("[ad] bonus reward not earned"),
    );
  };

  const adBusy = ad.state === "showing" || ad.state === "loading";

  return (
    <div style={{ paddingBottom: 140 }}>
      <Top
        title={
          <Top.TitleParagraph size={28}>
            {applied ? "적립됐어요! 🎉" : "잘 발랐어요!"}
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            {slotIndex + 1}번째 도포
            {applied ? " · 적립 완료" : " · 광고 보고 받기"}
          </Top.SubtitleParagraph>
        }
      />

      <div style={{ padding: "16px 24px 24px" }}>
        <div
          style={{
            background: applied
              ? "linear-gradient(135deg, #FF9B3C 0%, #FF7E2E 100%)"
              : "#F8FAFC",
            borderRadius: 20,
            padding: 28,
            color: applied ? "#fff" : "#0F172A",
            textAlign: "center",
            border: applied ? "none" : "2px dashed #E2E8F0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <EmojiBubble
              size={64}
              background={applied ? "rgba(255,255,255,0.22)" : "#FFF3EC"}
            >
              {applied ? "🎉" : "🧴"}
            </EmojiBubble>
          </div>
          <div
            style={{
              fontSize: 14,
              opacity: applied ? 0.85 : 0.6,
              marginBottom: 8,
            }}
          >
            {applied ? "이번 회차 적립" : "받을 수 있는 적립금"}
          </div>
          <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1 }}>
            {applied ? "+" : ""}
            {applied ? totalThisSlot : slot.baseReward}
            <span style={{ fontSize: 22, fontWeight: 700, marginLeft: 4 }}>
              원
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              opacity: applied ? 0.85 : 0.6,
              marginTop: 12,
            }}
          >
            {applied
              ? `기본 ${slot.baseReward}원${slot.adBonusReward > 0 ? ` + 광고 ${slot.adBonusReward}원` : ""}`
              : "광고를 봐야 적립돼요"}
          </div>
        </div>

        {applied && (
          <div
            style={{
              marginTop: 24,
              background: "#F8FAFC",
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#0F172A",
                marginBottom: 4,
              }}
            >
              광고 더 보고 +{AD_BONUS_PER_VIEW}원 받기
            </div>
            <div style={{ fontSize: 13, color: "#64748B" }}>
              남은 횟수 {adBonusLeft}/{AD_BONUS_MAX_PER_SLOT}
              {ad.isTest ? " · 테스트 광고" : ""}
            </div>
            <div style={{ marginTop: 12 }}>
              <Button
                size="large"
                display="block"
                variant="weak"
                color="primary"
                onClick={watchBonusAd}
                disabled={adBonusLeft === 0 || !ad.supported || adBusy}
                loading={ad.state === "showing"}
              >
                {!ad.supported
                  ? "광고 미지원 환경"
                  : adBonusLeft === 0
                    ? "이번 회차 광고 다 봤어요"
                    : ad.state === "loading"
                      ? "광고 준비 중…"
                      : `광고 보고 +${AD_BONUS_PER_VIEW}원`}
              </Button>
            </div>
          </div>
        )}

        {!applied && (
          <div
            style={{
              marginTop: 16,
              fontSize: 12,
              color: "#94A3B8",
              textAlign: "center",
            }}
          >
            광고를 보지 않으면 적립되지 않아요
          </div>
        )}
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 24px 28px",
          background: "linear-gradient(to top, #fff 60%, transparent)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {applied ? (
          <Button
            size="xlarge"
            display="block"
            onClick={() => {
              trackClick("press_back_home_after_apply", {
                slot_index: slotIndex,
                applied: true,
                earned: totalThisSlot,
              });
              navigate("home");
            }}
            style={CTA_GRADIENT_STYLE}
          >
            확인
          </Button>
        ) : (
          <>
            <Button
              size="xlarge"
              display="block"
              onClick={watchPrimaryAd}
              disabled={!ad.supported || adBusy}
              loading={ad.state === "showing"}
              style={CTA_GRADIENT_STYLE}
            >
              {!ad.supported
                ? "광고 미지원 환경"
                : ad.state === "loading"
                  ? "광고 준비 중…"
                  : `광고 보고 ${slot.baseReward}원 받기`}
            </Button>
            <Button
              size="medium"
              display="block"
              variant="weak"
              color="dark"
              onClick={() => {
                trackClick("press_back_home_after_apply", {
                  slot_index: slotIndex,
                  applied: false,
                  earned: 0,
                });
                navigate("home");
              }}
            >
              다음에 받기
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
