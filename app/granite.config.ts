import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "dailysuncream",
  brand: {
    displayName: "선크림 알림",
    primaryColor: "#FF8A4C",
    icon: "",
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
