import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import config from "../granite.config.ts";
import App from "./App.tsx";
import { clearAllSunalarmKeys } from "./lib/storage.ts";
import "./index.css";

// `?reset=1` 또는 `?reset` 쿼리스트링이 붙어 있으면 모든 저장 데이터를 삭제하고
// 깨끗한 URL로 부드럽게 진입해요. 실기기 샌드박스에서도 트리거 가능.
if (
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("reset")
) {
  const removed = clearAllSunalarmKeys();
  console.log("[reset] cleared", removed, "keys via ?reset=");
  const cleanUrl =
    window.location.pathname + window.location.hash.replace(/^#?/, "");
  window.history.replaceState(null, "", cleanUrl || "/");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TDSMobileAITProvider brandPrimaryColor={config.brand.primaryColor}>
      <App />
    </TDSMobileAITProvider>
  </StrictMode>,
);
