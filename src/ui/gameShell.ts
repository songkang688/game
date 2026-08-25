/**
 * 游戏壳:顶栏(返回、标题、星星) + 游戏舞台 + 胜负结算。
 * 负责把 GameAPI 交给游戏模块,并在离开时清理。
 */
import type { GameAPI, GameModule } from "../engine/types";
import { save } from "../engine/save";
import { playSound } from "../engine/audio";
import { showResultDialog, type DialogHandle } from "./dialogs";

export function mountGameScreen(
  container: HTMLElement,
  game: GameModule,
  goHome: () => void
): () => void {
  const screen = document.createElement("div");
  screen.className = "screen game-screen";
  container.appendChild(screen);

  // ---- 顶栏 ----
  const topbar = document.createElement("header");
  topbar.className = "game-topbar";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "btn btn--back";
  backBtn.innerHTML = `<span aria-hidden="true">←</span> 返回`;
  backBtn.setAttribute("aria-label", "返回首页");
  backBtn.addEventListener("click", () => {
    playSound("tap");
    goHome();
  });

  const title = document.createElement("div");
  title.className = "game-title";
  title.textContent = `${game.meta.emoji} ${game.meta.title}`;

  const starChip = document.createElement("div");
  starChip.className = "chip star-chip";
  const renderStars = (): void => {
    starChip.textContent = `⭐ ${save.getStars()}`;
  };
  renderStars();
  const unsubscribe = save.onChange(renderStars);

  topbar.append(backBtn, title, starChip);
  screen.appendChild(topbar);

  // ---- 舞台 ----
  const stage = document.createElement("div");
  stage.className = "game-stage";
  screen.appendChild(stage);

  let mounted: { destroy: () => void } | null = null;
  let dialog: DialogHandle | null = null;
  let finished = false;

  function closeDialog(): void {
    dialog?.close();
    dialog = null;
  }

  function unmount(): void {
    try {
      mounted?.destroy();
    } catch (err) {
      console.warn(`[一朵一星] 游戏 ${game.meta.id} destroy 时出错:`, err);
    }
    mounted = null;
    stage.innerHTML = "";
  }

  function start(): void {
    closeDialog();
    unmount();
    finished = false;
    save.recordPlay(game.meta.id);

    const api: GameAPI = {
      root: stage,
      play: playSound,
      addStars: (n) => save.addStars(n),
      getStars: () => save.getStars(),
      onWin: (stars, message) => {
        if (finished) return;
        finished = true;
        save.recordWin(game.meta.id, stars);
        save.addStars(stars);
        playSound("win");
        dialog = showResultDialog({
          win: true,
          stars,
          message,
          onReplay: start,
          onHome: goHome
        });
      },
      onLose: (message) => {
        if (finished) return;
        finished = true;
        playSound("oops");
        dialog = showResultDialog({
          win: false,
          message,
          onReplay: start,
          onHome: goHome
        });
      }
    };

    try {
      mounted = game.mount(api);
    } catch (err) {
      console.error(`[一朵一星] 游戏 ${game.meta.id} 启动失败:`, err);
      stage.innerHTML = `<div class="empty-state"><div class="empty-emoji">🛠️</div><p>这个游戏出了点小问题,先玩别的吧!</p></div>`;
    }
  }

  start();

  return () => {
    closeDialog();
    unmount();
    unsubscribe();
    screen.remove();
  };
}
