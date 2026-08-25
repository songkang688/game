import "./styles.css";
import { loadGames } from "./engine/loader";
import { createApp } from "./ui/app";

function setupPWA(): void {
  if (!("serviceWorker" in navigator)) return;
  // Electron / Capacitor 以 file:// 加载 dist 时不注册 Service Worker
  if (location.protocol === "file:") return;
  import("virtual:pwa-register")
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {
      // 开发模式或不支持时静默跳过
    });
}

const appEl = document.getElementById("app");
if (appEl) {
  createApp(appEl, loadGames());
}
setupPWA();
