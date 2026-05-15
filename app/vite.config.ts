import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// 빌드 가드: prod 빌드 시 VITE_API_URL 누락/localhost면 빌드 차단.
// 5/15 사고 — .env.local 없이 빌드해서 모든 사용자 번들에 localhost가 박혀
// 서버 호출이 전부 실패했던 사고 재발 방지.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (command === "build") {
    const apiUrl = env.VITE_API_URL;
    if (!apiUrl) {
      throw new Error(
        "[build] VITE_API_URL 미설정 — app/.env.local에 Workers URL을 채워주세요.",
      );
    }
    if (/localhost|127\.0\.0\.1/.test(apiUrl)) {
      throw new Error(
        `[build] VITE_API_URL이 localhost(${apiUrl}) — 프로덕션 번들에 localhost가 박히면 토스 인앱에서 서버 호출이 전부 실패해요.`,
      );
    }
  }
  return {
    plugins: [react()],
  };
});
