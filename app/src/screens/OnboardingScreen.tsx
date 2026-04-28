import { Button, Top } from "@toss/tds-mobile";
import { useEffect, useMemo, useState } from "react";
import { EmojiBubble } from "../components/EmojiBubble";
import { trackClick, trackScreen } from "../lib/track";
import {
  formatHm,
  recommendedSlotMinutes,
  skinTypeLabel,
  type Environment,
  type SkinType,
} from "../lib/recommendation";
import { useAppStore } from "../store/useAppStore";
import { useProfileStore } from "../store/useProfileStore";

const SKIN_TYPES: SkinType[] = ["I", "II", "III", "IV", "V_VI"];
const ENVIRONMENTS: { value: Environment; label: string; desc: string }[] = [
  { value: "outdoor", label: "주로 실외", desc: "통근·외부 활동이 많아요" },
  { value: "mixed", label: "반반", desc: "실내 + 외출이 섞여요" },
  { value: "indoor", label: "주로 실내", desc: "사무실·집에서 보내요" },
];

export function OnboardingScreen() {
  const setProfile = useProfileStore((s) => s.setProfile);
  const navigate = useAppStore((s) => s.navigate);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [skinType, setSkinType] = useState<SkinType>("III");
  const [environment, setEnvironment] = useState<Environment>("outdoor");
  const [startMinute, setStartMinute] = useState(9 * 60);
  const [endMinute, setEndMinute] = useState(18 * 60);

  useEffect(() => {
    trackScreen("screen_onboarding", { step });
  }, [step]);

  const previewSlots = useMemo(
    () =>
      recommendedSlotMinutes({
        skinType,
        environment,
        startMinute,
        endMinute,
      }),
    [skinType, environment, startMinute, endMinute],
  );

  const submit = () => {
    trackClick("press_onboarding_complete", {
      skin: skinType,
      env: environment,
      start: startMinute,
      end: endMinute,
      slots: previewSlots.length,
    });
    setProfile({
      skinType,
      environment,
      startMinute,
      endMinute,
      completedAt: Date.now(),
    });
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
                        color: "#FF8A4C",
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
          <Section title="알림 받을 시간을 정해주세요">
            <TimeRow
              label="시작"
              minute={startMinute}
              onChange={setStartMinute}
            />
            <TimeRow label="종료" minute={endMinute} onChange={setEndMinute} />
            <div
              style={{
                marginTop: 20,
                background: "#F8FAFC",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "#64748B",
                  marginBottom: 8,
                }}
              >
                추천 시간 ({previewSlots.length}회)
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {previewSlots.map((m, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "8px 12px",
                      background: "#FF8A4C",
                      color: "#fff",
                      borderRadius: 999,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {formatHm(m)}
                  </span>
                ))}
              </div>
            </div>
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
          <Button size="xlarge" display="block" onClick={submit}>
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
        border: `2px solid ${selected ? "#FF8A4C" : "transparent"}`,
        borderRadius: 14,
        padding: "16px 20px",
        cursor: "pointer",
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

function TimeRow({
  label,
  minute,
  onChange,
}: {
  label: string;
  minute: number;
  onChange: (m: number) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 20px",
        background: "#F8FAFC",
        borderRadius: 14,
        marginBottom: 8,
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 600, color: "#0F172A" }}>
        {label}
      </span>
      <select
        value={Math.floor(minute / 60)}
        onChange={(e) => onChange(Number(e.target.value) * 60)}
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#FF8A4C",
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 14,
          padding: "8px 12px",
        }}
      >
        {hours.map((h) => (
          <option key={h} value={h}>
            {h.toString().padStart(2, "0")}:00
          </option>
        ))}
      </select>
    </div>
  );
}
