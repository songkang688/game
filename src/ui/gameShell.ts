/**
 * 游戏壳:顶栏(返回、标题、星星) + 游戏舞台 + 胜负结算。
 * 负责把 GameAPI 交给游戏模块,并在离开时清理。
 */
import type { GameAPI, GameModule } from "../engine/types";
import { save } from "../engine/save";
import { isBgmOn, playSound, toggleBgm } from "../engine/audio";
import { showResultDialog, type DialogHandle } from "./dialogs";
import { createDuoPair } from "./avatars";
import { recordRecent } from "./recent";

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
  backBtn.innerHTML = `<span aria-hidden="true">🏠</span><span class="btn-back-label">返回</span>`;
  backBtn.setAttribute("aria-label", "返回首页");
  backBtn.addEventListener("click", () => {
    playSound("tap");
    goHome();
  });

  const title = document.createElement("div");
  title.className = "game-title";
  const titleEmoji = document.createElement("span");
  titleEmoji.className = "game-title-emoji";
  titleEmoji.setAttribute("aria-hidden", "true");
  titleEmoji.textContent = game.meta.emoji;
  const titleText = document.createElement("span");
  titleText.className = "game-title-text";
  titleText.textContent = game.meta.title;
  title.append(titleEmoji, titleText);

  const starChip = document.createElement("div");
  starChip.className = "chip star-chip";
  const renderStars = (): void => {
    starChip.textContent = `⭐ ${save.getStars()}`;
  };
  renderStars();
  const unsubscribe = save.onChange(renderStars);

  const duoPair = createDuoPair(38);
  duoPair.title = "朵朵和星星陪你一起玩";

  // 游戏内也能开关背景音乐(与首页共用同一个 BGM 实例)
  const bgmBtn = document.createElement("button");
  bgmBtn.type = "button";
  bgmBtn.className = "icon-btn";
  bgmBtn.title = "背景音乐";
  const renderBgm = (): void => {
    const on = isBgmOn();
    bgmBtn.textContent = "🎵";
    bgmBtn.style.opacity = on ? "1" : "0.4";
    bgmBtn.setAttribute("aria-pressed", String(on));
    bgmBtn.setAttribute("aria-label", on ? "关闭背景音乐" : "打开背景音乐");
  };
  renderBgm();
  bgmBtn.addEventListener("click", () => {
    toggleBgm();
    renderBgm();
  });

  topbar.append(backBtn, title, duoPair, bgmBtn, starChip);
  screen.appendChild(topbar);

  // ---- 舞台 ----
  const stage = document.createElement("div");
  stage.className = "game-stage";
  screen.appendChild(stage);

  let mounted: { destroy: () => void } | null = null;
  let dialog: DialogHandle | null = null;
  let finished = false;
  // 异步加载防竞态:每次 start 领一个序号,过期(重开/离开)的结果直接丢弃
  let startSeq = 0;
  let disposed = false;

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

  function showLoading(): void {
    stage.innerHTML = `<div class="game-loading" role="status"><span class="game-loading-flower" aria-hidden="true">🌸</span><p class="game-loading-text">马上就好～</p></div>`;
  }

  function showError(): void {
    stage.innerHTML = `<div class="empty-state"><div class="empty-emoji">🛠️</div><p>这个游戏出了点小问题,先玩别的吧!</p></div>`;
  }

  function start(): void {
    const seq = ++startSeq;
    closeDialog();
    unmount();
    finished = false;
    save.recordPlay(game.meta.id);
    // 深链/PWA 恢复直接进游戏也要进「最近玩过」,所以记录放在壳里而不是首页
    recordRecent(game.meta.id);
    showLoading();

    const stale = (): boolean => disposed || seq !== startSeq;

    const api: GameAPI = {
      root: stage,
      play: playSound,
      addStars: (n) => save.addStars(n),
      getStars: () => save.getStars(),
      onWin: (stars, message) => {
        if (finished || stale()) return;
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
        if (finished || stale()) return;
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

    game
      .load()
      .then((mount) => {
        if (stale()) return;
        stage.innerHTML = "";
        try {
          mounted = mount(api);
        } catch (err) {
          console.error(`[一朵一星] 游戏 ${game.meta.id} 启动失败:`, err);
          showError();
        }
      })
      .catch((err: unknown) => {
        if (stale()) return;
        console.error(`[一朵一星] 游戏 ${game.meta.id} 加载失败:`, err);
        showError();
      });
  }

  start();

  return () => {
    disposed = true;
    closeDialog();
    unmount();
    unsubscribe();
    screen.remove();
  };
}
