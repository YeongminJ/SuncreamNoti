import { appLogin } from "@apps-in-toss/web-framework";
import { useEffect } from "react";
import { DevResetButton } from "./components/DevResetButton";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingSplash } from "./components/LoadingSplash";
import { getUserKey, loginWithToss } from "./lib/api";
import { ApplyResultScreen } from "./screens/ApplyResultScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { useAppStore } from "./store/useAppStore";
import { useAuthStore } from "./store/useAuthStore";
import { useProfileStore } from "./store/useProfileStore";
import "./App.css";

function App() {
  const screen = useAppStore((s) => s.screen);
  const navigate = useAppStore((s) => s.navigate);
  const welcomeAcknowledged = useAppStore((s) => s.welcomeAcknowledged);
  const profile = useProfileStore((s) => s.profile);
  const authStatus = useAuthStore((s) => s.status);

  // 1단계: 진입 즉시 토스 로그인 시도. 모든 사용자가 같은 시점에 거치는 게이트.
  useEffect(() => {
    if (useAuthStore.getState().status !== "idle") return;
    const auth = useAuthStore.getState();
    auth.setPending();

    void (async () => {
      try {
        const result = await appLogin();
        if (
          result &&
          typeof result === "object" &&
          "authorizationCode" in result &&
          typeof result.authorizationCode === "string"
        ) {
          const referrer =
            "referrer" in result && result.referrer === "SANDBOX"
              ? "SANDBOX"
              : "DEFAULT";
          auth.setLoggedIn({
            authorizationCode: result.authorizationCode,
            referrer,
          });
          if (import.meta.env.DEV) {
            console.debug("[app] appLogin ok", referrer);
          }
        } else {
          // 토스 환경 아님 (브라우저 dev 등) — 게스트로 진행
          auth.setSkipped();
          if (import.meta.env.DEV) {
            console.debug("[app] appLogin unsupported, skipping");
          }
        }
      } catch (err) {
        console.warn("[app] appLogin threw, continuing as guest", err);
        useAuthStore.getState().setFailed();
      }
    })();
  }, []);

  // 2단계: 로그인 결과 + 프로필 상태로 진입 화면 결정.
  // pending 동안에는 라우팅하지 않고 스플래시를 그대로 둬요.
  useEffect(() => {
    if (authStatus === "idle" || authStatus === "pending") return;
    if (profile) {
      if (screen !== "home" && screen !== "applyResult") navigate("home");
    } else if (welcomeAcknowledged) {
      if (screen !== "onboarding") navigate("onboarding");
    } else {
      if (screen !== "welcome") navigate("welcome");
    }
    // 첫 진입(=인증 결정 직후)만 라우팅. 이후 화면 이동은 각 화면이 처리.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  // 3단계: 재방문 사용자(이미 프로필 있음) + 로그인 성공 → 백그라운드로 토스 user key 갱신.
  // 첫 가입(=온보딩) 사용자는 OnboardingScreen 제출 흐름에서 처리하므로 여기선 건너뜀.
  useEffect(() => {
    if (authStatus !== "loggedIn") return;
    if (!profile) return;
    if (useAuthStore.getState().tossUserKey != null) return;

    void (async () => {
      const userKey = await getUserKey();
      if (!userKey) return;
      const { authorizationCode, referrer } = useAuthStore.getState();
      if (!authorizationCode || !referrer) return;
      const res = await loginWithToss({
        userKey,
        authorizationCode,
        referrer,
      });
      if (res.ok && typeof res.tossUserKey === "number") {
        useAuthStore.getState().setTossUserKey(res.tossUserKey);
      }
    })();
  }, [authStatus, profile]);

  if (authStatus === "idle" || authStatus === "pending") {
    return (
      <ErrorBoundary>
        <LoadingSplash />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      {screen === "welcome" ? <WelcomeScreen /> : null}
      {screen === "onboarding" ? <OnboardingScreen /> : null}
      {screen === "home" ? <HomeScreen /> : null}
      {screen === "applyResult" ? <ApplyResultScreen /> : null}
      <DevResetButton />
    </ErrorBoundary>
  );
}

export default App;
