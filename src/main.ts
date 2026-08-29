import "./styles.css";
import { loadGames } from "./engine/loader";
import { createApp } from "./ui/app";
import { bindVisualViewportHeight } from "./ui/viewportHeight";
import { restoreFromVault, startAutoBackup } from "./engine/vault";

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

/**
 * 开机自检:本地一片空白(新装 / 卸载重装 / 刚清空)时,把保险箱里的进度接回来。
 * 本地已经有进度就一律不碰,恢复交给家长面板里的按钮。
 * 恢复发生在建界面之前,首页的星星和关卡进度一上来就是对的。
 */
function bootVault(mount: () => void): void {
  let mounted = false;
  const go = (): void => {
    if (mounted) return;
    mounted = true;
    mount();
    startAutoBackup();
  };
  // 保险箱慢或没反应都不能把孩子挡在门外:最多等 1.5 秒就先开门
  const guard = window.setTimeout(go, 1500);
  restoreFromVault()
    .catch(() => undefined)
    .then(() => {
      window.clearTimeout(guard);
      go();
    });
}

const appEl = document.getElementById("app");
if (appEl) {
  bindVisualViewportHeight();
  bootVault(() => createApp(appEl, loadGames()));
}
setupPWA();
