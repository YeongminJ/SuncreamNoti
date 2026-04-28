import { useEffect } from "react";
import { DevResetButton } from "./components/DevResetButton";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ApplyResultScreen } from "./screens/ApplyResultScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { useAppStore } from "./store/useAppStore";
import { useProfileStore } from "./store/useProfileStore";
import "./App.css";

function App() {
  const screen = useAppStore((s) => s.screen);
  const navigate = useAppStore((s) => s.navigate);
  const welcomeAcknowledged = useAppStore((s) => s.welcomeAcknowledged);
  const profile = useProfileStore((s) => s.profile);

  // 첫 마운트 시 진입 화면 결정
  // - 프로필 있으면 → home (재방문 사용자)
  // - 프로필 없고 welcome 본 적 있으면 → onboarding
  // - 프로필 없고 welcome 안 본 사용자 → welcome
  useEffect(() => {
    if (profile) {
      if (screen !== "home" && screen !== "applyResult") navigate("home");
    } else if (welcomeAcknowledged) {
      if (screen !== "onboarding") navigate("onboarding");
    } else {
      if (screen !== "welcome") navigate("welcome");
    }
    // 의도적으로 첫 마운트만 영향
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
