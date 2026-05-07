import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "dailysuncream",
  brand: {
    displayName: "매일 선크림",
    primaryColor: "#FF9B3C",
    // 콘솔에 업로드한 600×600 로고의 Toss CDN URL — 콘솔과 완전히 동일한 이미지를 참조해요.
    icon: "https://static.toss.im/appsintoss/36039/e4b4e8b1-5fa1-4c28-9458-33bcaf3688a0.png",
  },
  web: {
    // 실기기 샌드박스에서 이 값을 참조해요. Wi-Fi가 바뀌면 현재 Mac LAN IP로
    // 갱신해주세요: `ipconfig getifaddr en0`
    host: "192.168.68.113",
    port: 5273,
    commands: {
      dev: "vite dev --host --port 5273",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});
