import { useEffect } from "react";
import { DevResetButton } from "./components/DevResetButton";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WhoAmIBadge } from "./components/WhoAmIBadge";
import { LoadingSplash } from "./components/LoadingSplash";
import {
  fetchAuthStatus,
  getServerUser,
  getUserKey,
  registerUser,
} from "./lib/api";
import { installBackHandler } from "./lib/backHandler";
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

  // 1단계: 기존 매핑 정보만 조회하고 바로 라우팅.
  // 진입 시 토스 로그인(appLogin)을 띄우지 않아요 — 검수 정책상 서비스 소개가 먼저
  // 노출돼야 하고, 푸시는 hash 인증(x-anon-key)이라 로그인 없이도 발송돼요.
  useEffect(() => {
    if (useAuthStore.getState().status !== "idle") return;
    useAuthStore.getState().setPending();

    void (async () => {
      try {
        const localUserKey = await getUserKey();
        if (localUserKey) {
          const status = await fetchAuthStatus(localUserKey);
          if (typeof status.tossUserKey === "number") {
            useAuthStore.getState().setTossUserKey(status.tossUserKey);
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.debug("[app] auth status check failed", err);
        }
      }
      useAuthStore.getState().setSkipped();
    })();
  }, []);

  // 네이티브 뒤로가기: 열린 시트/단계가 먼저 소비하고, 남으면 화면 단위로 이전 화면 이동.
  // 루트 화면(인트로·홈)에서만 미니앱 종료.
  useEffect(() => {
    return installBackHandler((exit) => {
      const current = useAppStore.getState().screen;
      if (current === "applyResult") {
        useAppStore.getState().navigate("home");
      } else if (current === "onboarding") {
        useAppStore.getState().navigate("welcome");
      } else {
        exit();
      }
    });
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

  // 3단계: 슬롯 동기화 검증.
  // 로컬 profile.slotMinutes와 서버 user_slots가 불일치하면 자동 재등록.
  // 서버에 행이 없는 경우(재설치 등으로 anonymousKey가 바뀐 재방문자)도
  // 빈 슬롯으로 비교돼 여기서 재등록돼요.
  useEffect(() => {
    if (authStatus === "idle" || authStatus === "pending") return;
    if (!profile) return;

    void (async () => {
      const userKey = await getUserKey();
      if (!userKey) return;

      const server = await getServerUser(userKey);
      if (server.status === "error") return;

      const localSlots = [...profile.slotMinutes].sort((a, b) => a - b);
      const serverSlots = (server.slots ?? []).slice().sort((a, b) => a - b);

      const matches =
        localSlots.length === serverSlots.length &&
        localSlots.every((m, i) => m === serverSlots[i]);

      if (!matches && localSlots.length > 0) {
        const reg = await registerUser({
          userKey,
          skinType: profile.skinType,
          environment: profile.environment,
          startMinute: localSlots[0],
          endMinute: localSlots[localSlots.length - 1],
          slotMinutes: localSlots,
        });
        if (import.meta.env.DEV) {
          console.debug(
            "[app] slot mismatch resynced",
            { local: localSlots, server: serverSlots, ok: reg.ok },
          );
        }
      }
    })();
  }, [authStatus, profile]);

  if (authStatus === "idle" || authStatus === "pending") {
    return (
      <ErrorBoundary>
        <LoadingSplash />
        <WhoAmIBadge />
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
      <WhoAmIBadge />
    </ErrorBoundary>
  );
}

export default App;
