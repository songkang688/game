import "./styles.css";
import { loadGames } from "./engine/loader";
import { createApp } from "./ui/app";
import { bindVisualViewportHeight } from "./ui/viewportHeight";

/** 底部小吐司:提示有新版本,点一下就更新 */
function showUpdateToast(onUpdate: () => void): void {
  if (document.querySelector(".pwa-update-toast")) return;
  const toast = document.createElement("button");
  toast.type = "button";
  toast.className = "pwa-update-toast";
  toast.textContent = "有新版本啦,点我更新 ✨";
  toast.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:18px",
    "transform:translateX(-50%)",
    "z-index:9999",
    "padding:10px 20px",
    "border:3px solid #ffd9ea",
    "border-radius:999px",
    "background:#fff5fa",
    "color:#c73a80",
    "font:inherit",
    "font-weight:bold",
    "box-shadow:0 8px 20px rgba(199,58,128,0.25)",
    "cursor:pointer"
  ].join(";");
  toast.addEventListener("click", () => {
    toast.disabled = true;
    toast.textContent = "正在更新…";
    onUpdate();
  });
  document.body.appendChild(toast);
}

function setupPWA(): void {
  if (!("serviceWorker" in navigator)) return;
  // Electron / Capacitor 以 file:// 加载 dist 时不注册 Service Worker
  if (location.protocol === "file:") return;
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          showUpdateToast(() => {
            void updateSW(true);
          });
        }
      });
    })
    .catch(() => {
      // 开发模式或不支持时静默跳过
    });
}

const appEl = document.getElementById("app");
if (appEl) {
  bindVisualViewportHeight();
  createApp(appEl, loadGames());
}
setupPWA();
