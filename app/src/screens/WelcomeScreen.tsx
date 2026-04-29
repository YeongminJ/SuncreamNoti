import { Button } from "@toss/tds-mobile";
import { useEffect } from "react";
import { EmojiBubble } from "../components/EmojiBubble";
import { trackClick, trackScreen } from "../lib/track";
import { useAppStore } from "../store/useAppStore";

interface Feature {
  icon: string;
  iconBg: string;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: "☀️",
    iconBg: "#FFF3EC",
    title: "자외선은 피부 노화의 80% 원인이에요",
    description: "매일 선크림이 가장 효과적인 안티에이징이에요",
  },
  {
    icon: "🧴",
    iconBg: "#FEF3C7",
    title: "2~3시간마다 다시 발라야 해요",
    description: "오늘의 권장 시간을 한눈에 보여드려요",
  },
  {
    icon: "🎁",
    iconBg: "#DCFCE7",
    title: "광고 보고 하루 최대 15원 받아요",
    description: "꾸준히 발라서 포인트도 챙겨가세요",
  },
];

export function WelcomeScreen() {
  const acknowledgeWelcome = useAppStore((s) => s.acknowledgeWelcome);
  const navigate = useAppStore((s) => s.navigate);

  useEffect(() => {
    trackScreen("screen_welcome");
  }, []);

  const start = () => {
    trackClick("press_welcome_start");
    acknowledgeWelcome();
    navigate("onboarding");
  };

  return (
    <div style={{ paddingBottom: 140, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ padding: "32px 24px 0" }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            lineHeight: 1.3,
            color: "#0F172A",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          매일 선크림 바르고
          <br />
          피부도, 포인트도 챙겨요
        </h1>
      </div>

      {/* Hero visual: overlapping bubbles */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "44px 0 36px",
        }}
      >
        <div style={{ position: "relative", width: 220, height: 140 }}>
          <div style={{ position: "absolute", left: 0, top: 0 }}>
            <EmojiBubble size={130} background="#FF9B3C">
              <span style={{ filter: "saturate(1.2)" }}>🧴</span>
            </EmojiBubble>
          </div>
          <div style={{ position: "absolute", right: 0, top: 22 }}>
            <EmojiBubble size={108} background="#FFD66B">
              ☀️
            </EmojiBubble>
          </div>
        </div>
      </div>

      {/* Feature list with dashed connector */}
      <div style={{ padding: "0 24px" }}>
        {FEATURES.map((f, i) => {
          const isLast = i === FEATURES.length - 1;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 16,
                position: "relative",
                paddingBottom: isLast ? 0 : 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <EmojiBubble size={48} background={f.iconBg}>
                  {f.icon}
                </EmojiBubble>
                {!isLast && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      marginTop: 6,
                      marginBottom: -6,
                      background:
                        "repeating-linear-gradient(to bottom, #E2E8F0 0 4px, transparent 4px 8px)",
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1, paddingTop: 10, paddingBottom: 24 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#0F172A",
                    marginBottom: 4,
                    lineHeight: 1.4,
                  }}
                >
                  {f.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#64748B",
                    lineHeight: 1.5,
                  }}
                >
                  {f.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
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
        <Button size="xlarge" display="block" onClick={start}>
          내 피부 보호 시작하기
        </Button>
      </div>
    </div>
  );
}
