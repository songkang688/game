/**
 * 应用根:hash 路由(首页 / 游戏页)+ 背景漂浮装饰。
 */
import type { GameModule } from "../engine/types";
import { renderHome } from "./home";
import { mountGameScreen } from "./gameShell";

const DECOR_ITEMS: { emoji: string; cls: string }[] = [
  { emoji: "🌸", cls: "decor-item decor-1" },
  { emoji: "⭐", cls: "decor-item decor-2" },
  { emoji: "🌷", cls: "decor-item decor-3" },
  { emoji: "✨", cls: "decor-item decor-4" },
  { emoji: "🌼", cls: "decor-item decor-5" },
  { emoji: "💫", cls: "decor-item decor-6" }
];

export function createApp(rootEl: HTMLElement, games: GameModule[]): void {
  const decor = document.createElement("div");
  decor.className = "bg-decor";
  decor.setAttribute("aria-hidden", "true");
  for (const { emoji, cls } of DECOR_ITEMS) {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = emoji;
    decor.appendChild(span);
  }
  rootEl.appendChild(decor);

  const view = document.createElement("div");
  view.className = "view";
  rootEl.appendChild(view);

  let cleanup: (() => void) | null = null;

  function goHome(): void {
    if (location.hash) {
      location.hash = "";
    } else {
      route();
    }
  }

  function route(): void {
    cleanup?.();
    cleanup = null;
    view.innerHTML = "";

    const match = location.hash.match(/^#\/?game\/(.+)$/);
    const id = match?.[1] ? decodeURIComponent(match[1]) : null;
    if (id) {
      const game = games.find((g) => g.meta.id === id);
      if (game) {
        cleanup = mountGameScreen(view, game, goHome);
        return;
      }
    }
    cleanup = renderHome(view, games);
  }

  window.addEventListener("hashchange", route);
  route();
}
