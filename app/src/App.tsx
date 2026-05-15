import { appLogin } from "@apps-in-toss/web-framework";
import { useEffect } from "react";
import { DevResetButton } from "./components/DevResetButton";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WhoAmIBadge } from "./components/WhoAmIBadge";
import { LoadingSplash } from "./components/LoadingSplash";
import {
  fetchAuthStatus,
  getServerUser,
  getUserKey,
  loginWithToss,
  registerUser,
} from "./lib/api";
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

  // 1단계: 진입 즉시 매핑 사전 조회 → 미매핑 사용자만 토스 로그인 호출.
  // 이미 매핑된 재방문자는 OAuth 2단계 + 토스 동의 화면을 거치지 않고 바로 라우팅.
  useEffect(() => {
    if (useAuthStore.getState().status !== "idle") return;
    const auth = useAuthStore.getState();
    auth.setPending();

    void (async () => {
      // 1) 매핑 여부 사전 조회 — 서버 한 번만 보고 결정
      try {
        const localUserKey = await getUserKey();
        if (localUserKey) {
          const status = await fetchAuthStatus(localUserKey);
          if (typeof status.tossUserKey === "number") {
            // 이미 매핑됨 → store 채우고 appLogin 스킵
            useAuthStore.getState().setTossUserKey(status.tossUserKey);
            useAuthStore.getState().setSkipped();
            if (import.meta.env.DEV) {
              console.debug(
                "[app] already mapped, skip appLogin",
                status.tossUserKey,
              );
            }
            return;
          }
        }
      } catch (err) {
        // 사전 조회 실패는 fall-through로 appLogin 시도
        if (import.meta.env.DEV) {
          console.debug("[app] auth status check failed, fall through", err);
        }
      }

      // 2) 미매핑 사용자 → appLogin 호출 (기존 흐름)
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

      let res = await loginWithToss({
        userKey,
        authorizationCode,
        referrer,
      });

      // 서버에 users 행이 없는 경우 — 로컬 프로필로 재등록 후 재시도.
      // 재설치/디바이스 교체 등으로 anonymousKey가 갱신된 재방문자 자동 복구.
      if (!res.ok && res.errorCode === "user_not_registered") {
        const sorted = [...profile.slotMinutes].sort((a, b) => a - b);
        if (sorted.length > 0) {
          const reg = await registerUser({
            userKey,
            skinType: profile.skinType,
            environment: profile.environment,
            startMinute: sorted[0],
            endMinute: sorted[sorted.length - 1],
            slotMinutes: sorted,
          });
          if (reg.ok) {
            if (import.meta.env.DEV) {
              console.debug("[app] re-registered user, retry loginWithToss");
            }
            res = await loginWithToss({
              userKey,
              authorizationCode,
              referrer,
            });
          }
        }
      }

      if (res.ok && typeof res.tossUserKey === "number") {
        useAuthStore.getState().setTossUserKey(res.tossUserKey);
      }
    })();
  }, [authStatus, profile]);

  // 4단계: 슬롯 동기화 검증.
  // 로컬 profile.slotMinutes와 서버 user_slots가 불일치하면 자동 재등록.
  // users.ts 라우트가 비트랜잭션이라 5/8 사례처럼 슬롯이 비어있는 부분 실패 잔재가
  // 생길 수 있어요 (서버는 batch로 보강됐지만 이미 만들어진 깨진 행 자동 복구용).
  useEffect(() => {
    if (authStatus === "idle" || authStatus === "pending") return;
    if (!profile) return;

    void (async () => {
      const userKey = await getUserKey();
      if (!userKey) return;

      const server = await getServerUser(userKey);
      if (server.status === "error") return;
      // not_found는 step 3의 user_not_registered fallback이 처리 — 여기선 패스

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
