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
import { registerLevelExtras } from "./level188Contract";
import { loadGuideBook, mountGuide, readCurrentLevel } from "./guide";

// ---------------------------------------------------------------------------
// 关卡框架的两个外挂能力:攻略侧栏(本档实现)与跳关授权(家长高权限门)
// ---------------------------------------------------------------------------

/** 游戏 id → 中文名,给家长看的授权说明用(壳层每次挂载时补一条) */
const gameTitles = new Map<string, string>();

// 家长高权限门 `src/ui/parentAuth.ts` 由另一档提供,可能还没合进来。
// 用 glob 懒加载而不是写死的动态 import:文件不在时 glob 返回空表,
// 构建期不会报「模块找不到」,运行期直接判定为"无授权能力"。
const parentAuthModules = import.meta.glob("./parentAuth.ts") as Record<
  string,
  () => Promise<unknown>
>;

interface ParentAuthModule {
  requestParentAuth: (level: "basic" | "high", reason: string) => Promise<boolean>;
}

async function loadParentAuth(): Promise<ParentAuthModule | null> {
  const loader = parentAuthModules["./parentAuth.ts"];
  if (!loader) return null;
  const mod = await loader().catch(() => null);
  if (!mod || typeof (mod as ParentAuthModule).requestParentAuth !== "function") return null;
  return mod as ParentAuthModule;
}

/** 跳关授权说明(level 与关卡框架一致,0 基;显示时 +1) */
export function skipReason(gameId: string, level: number): string {
  const title = gameTitles.get(gameId) ?? gameId;
  return `孩子想跳过《${title}》第 ${level + 1} 关,需要家长确认`;
}

/** 请求跳关授权:家长高权限门通过才返回 true;门还没接上时一律不放行 */
export async function requestSkip(gameId: string, level: number): Promise<boolean> {
  const m = await loadParentAuth();
  if (!m) return false;
  try {
    return (await m.requestParentAuth("high", skipReason(gameId, level))) === true;
  } catch {
    return false;
  }
}

registerLevelExtras({ mountGuide, requestSkip });

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

  // 攻略按钮的位置(有攻略数据才会被填上,没有就是个空占位)
  const guideSlot = document.createElement("div");
  guideSlot.className = "guide-slot";

  topbar.append(backBtn, title, duoPair, bgmBtn, guideSlot, starChip);
  screen.appendChild(topbar);

  gameTitles.set(game.meta.id, game.meta.title);

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

  // 攻略数据是每款游戏自己的 `guide.ts`,没有这个模块就静默不显示攻略按钮
  let guideCleanup: (() => void) | null = null;
  void loadGuideBook(game.meta.id).then((book) => {
    if (!book || disposed) return;
    guideCleanup = mountGuide(guideSlot, book, () => readCurrentLevel(game.meta.id));
  });

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
    guideCleanup?.();
    guideCleanup = null;
    unsubscribe();
    screen.remove();
  };
}
