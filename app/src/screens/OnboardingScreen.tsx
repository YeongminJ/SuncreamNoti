import { appLogin } from "@apps-in-toss/web-framework";
import { Button, Top } from "@toss/tds-mobile";
import { useEffect, useMemo, useState } from "react";
import { EmojiBubble } from "../components/EmojiBubble";
import { getUserKey, loginWithToss, registerUser } from "../lib/api";
import {
  formatHm,
  guidanceText,
  recommendedSlotsFromStart,
  skinTypeLabel,
  type Environment,
  type SkinType,
} from "../lib/recommendation";
import { trackClick, trackScreen } from "../lib/track";
import { useAppStore } from "../store/useAppStore";
import { useProfileStore } from "../store/useProfileStore";

const SKIN_TYPES: SkinType[] = ["I", "II", "III", "IV", "V_VI"];
const ENVIRONMENTS: { value: Environment; label: string; desc: string }[] = [
  { value: "outdoor", label: "주로 실외", desc: "통근·외부 활동이 많아요" },
  { value: "mixed", label: "반반", desc: "실내 + 외출이 섞여요" },
  { value: "indoor", label: "주로 실내", desc: "사무실·집에서 보내요" },
];

/** Step 3 시간 chip grid: 06:00 ~ 22:00, 1시간 단위. */
const HOUR_GRID: number[] = Array.from(
  { length: 17 },
  (_, i) => (6 + i) * 60,
);
const MAX_SLOTS = 8;

export function OnboardingScreen() {
  const setProfile = useProfileStore((s) => s.setProfile);
  const navigate = useAppStore((s) => s.navigate);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [skinType, setSkinType] = useState<SkinType>("III");
  const [environment, setEnvironment] = useState<Environment>("outdoor");
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());

  useEffect(() => {
    trackScreen("screen_onboarding", { step });
  }, [step]);

  const sortedSlots = useMemo(
    () => [...selectedSlots].sort((a, b) => a - b),
    [selectedSlots],
  );

  const guidance = useMemo(
    () => guidanceText(skinType, environment),
    [skinType, environment],
  );

  const handleHourClick = (m: number) => {
    if (selectedSlots.size === 0) {
      // 첫 클릭 = 시작 시간 → 권장 간격으로 자동 채움
      const auto = recommendedSlotsFromStart(skinType, environment, m);
      setSelectedSlots(new Set(auto));
      return;
    }
    // 이후 클릭 = 토글
    const next = new Set(selectedSlots);
    if (next.has(m)) {
      next.delete(m);
    } else if (next.size < MAX_SLOTS) {
      next.add(m);
    }
    setSelectedSlots(next);
  };

  const resetSlots = () => setSelectedSlots(new Set());

  const submit = () => {
    if (sortedSlots.length === 0) return;
    trackClick("press_onboarding_complete", {
      skin: skinType,
      env: environment,
      slots: sortedSlots.length,
    });
    setProfile({
      skinType,
      environment,
      slotMinutes: sortedSlots,
      completedAt: Date.now(),
    });

    void (async () => {
      const userKey = await getUserKey();
      if (!userKey) return;

      const reg = await registerUser({
        userKey,
        skinType,
        environment,
        startMinute: sortedSlots[0],
        endMinute: sortedSlots[sortedSlots.length - 1],
        slotMinutes: sortedSlots,
      });
      if (!reg.ok) return;

      try {
        const auth = await appLogin();
        if (
          !auth ||
          typeof auth !== "object" ||
          !("authorizationCode" in auth)
        ) {
          if (import.meta.env.DEV) {
            console.debug(
              "[onboarding] appLogin 미지원 환경 (브라우저 dev) — 스킵",
            );
          }
          return;
        }
        if (import.meta.env.DEV) {
          console.debug(
            "[onboarding] appLogin 인가코드 획득, 서버 교환 시작",
          );
        }
        await loginWithToss({
          userKey,
          authorizationCode: auth.authorizationCode,
          referrer: auth.referrer,
        });
      } catch (err) {
        console.warn("[onboarding] toss login flow failed", err);
      }
    })();

    navigate("home");
  };

  return (
    <div style={{ paddingBottom: 120 }}>
      <Top
        title={
          <Top.TitleParagraph size={28}>
            선크림, 언제 발라볼까요?
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            {step}/3 · 잠깐만 알려주세요
          </Top.SubtitleParagraph>
        }
      />

      <div style={{ padding: "8px 24px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            margin: "8px 0 24px",
          }}
        >
          <EmojiBubble size={88} background="#FFF3EC">
            {step === 1 ? "🧴" : step === 2 ? "🌤️" : "⏰"}
          </EmojiBubble>
        </div>

        {step === 1 && (
          <Section title="햇볕에 30분 노출되면 어떻게 되나요?">
            {SKIN_TYPES.map((t) => (
              <ChoiceRow
                key={t}
                selected={skinType === t}
                onClick={() => setSkinType(t)}
                title={skinTypeLabel(t)}
                badge={
                  t === "III" ? (
                    <span
                      style={{
                        background: "#FFF3EC",
                        color: "#FF9B3C",
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 6,
                        marginLeft: 8,
                      }}
                    >
                      한국인 평균
                    </span>
                  ) : null
                }
              />
            ))}
          </Section>
        )}

        {step === 2 && (
          <Section title="평소에 어디서 시간을 더 많이 보내요?">
            {ENVIRONMENTS.map((e) => (
              <ChoiceRow
                key={e.value}
                selected={environment === e.value}
                onClick={() => setEnvironment(e.value)}
                title={e.label}
                description={e.desc}
              />
            ))}
          </Section>
        )}

        {step === 3 && (
          <Section title="언제부터 시작할까요?">
            {/* 가이드 카드 */}
            <div
              style={{
                background: "#FFF3EC",
                border: "1px solid #FFD9C2",
                borderRadius: 14,
                padding: "14px 16px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1.1 }}>🧴</span>
              <span
                style={{
                  fontSize: 14,
                  color: "#7A3A12",
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                {guidance}
              </span>
            </div>

            {/* 시간 chip grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {HOUR_GRID.map((m) => {
                const selected = selectedSlots.has(m);
                return (
                  <button
                    key={m}
                    onClick={() => handleHourClick(m)}
                    style={{
                      padding: "12px 0",
                      borderRadius: 12,
                      fontSize: 15,
                      fontWeight: 700,
                      background: selected ? "#FF9B3C" : "#F8FAFC",
                      color: selected ? "#FFFFFF" : "#0F172A",
                      border: "none",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      WebkitAppearance: "none",
                      appearance: "none",
                      outline: "none",
                      transition:
                        "background 120ms ease, color 120ms ease, transform 80ms ease",
                    }}
                  >
                    {Math.floor(m / 60)
                      .toString()
                      .padStart(2, "0")}
                  </button>
                );
              })}
            </div>

            {/* 안내 또는 요약 */}
            {selectedSlots.size === 0 ? (
              <div
                style={{
                  fontSize: 13,
                  color: "#64748B",
                  textAlign: "center",
                  padding: "8px 4px",
                  lineHeight: 1.5,
                }}
              >
                시작할 시간을 한 번 눌러주세요
                <br />
                권장 시간이 자동으로 표시돼요
              </div>
            ) : (
              <div
                style={{
                  background: "#F8FAFC",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: "#64748B",
                    }}
                  >
                    오늘 {sortedSlots.length}번 알림 받을게요
                  </div>
                  <button
                    onClick={resetSlots}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#64748B",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      padding: "4px 8px",
                      borderRadius: 8,
                    }}
                  >
                    초기화
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {sortedSlots.map((m) => (
                    <span
                      key={m}
                      style={{
                        padding: "6px 12px",
                        background: "#FF9B3C",
                        color: "#fff",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {formatHm(m)}
                    </span>
                  ))}
                </div>
                {selectedSlots.size >= MAX_SLOTS && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#94A3B8",
                      marginTop: 10,
                    }}
                  >
                    하루 최대 {MAX_SLOTS}회까지 받을 수 있어요
                  </div>
                )}
              </div>
            )}
          </Section>
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
          gap: 8,
        }}
      >
        {step > 1 && (
          <Button
            variant="weak"
            color="dark"
            size="xlarge"
            display="block"
            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
          >
            이전
          </Button>
        )}
        {step < 3 ? (
          <Button
            size="xlarge"
            display="block"
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
          >
            다음
          </Button>
        ) : (
          <Button
            size="xlarge"
            display="block"
            onClick={submit}
            disabled={selectedSlots.size === 0}
          >
            시작하기
          </Button>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 16,
          marginTop: 8,
          color: "#0F172A",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function ChoiceRow({
  selected,
  onClick,
  title,
  description,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: selected ? "#FFF3EC" : "#F8FAFC",
        border: `2px solid ${selected ? "#FF9B3C" : "transparent"}`,
        borderRadius: 14,
        padding: "16px 20px",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        WebkitAppearance: "none",
        appearance: "none",
        outline: "none",
        transition: "background 120ms ease, border-color 120ms ease",
        color: "inherit",
        font: "inherit",
      }}
      onTouchStart={(e) => {
        e.currentTarget.style.background = "#FFE7D6";
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.background = selected ? "#FFF3EC" : "#F8FAFC";
      }}
      onTouchCancel={(e) => {
        e.currentTarget.style.background = selected ? "#FFF3EC" : "#F8FAFC";
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: "#0F172A" }}>
          {title}
        </span>
        {badge}
      </div>
      {description && (
        <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
          {description}
        </div>
      )}
    </button>
  );
}
