/**
 * 游戏壳:顶栏(返回、标题、星星) + 游戏舞台 + 胜负结算 + 统一暂停面板。
 * 负责把 GameAPI 交给游戏模块,并在离开时清理。
 */
import type { GameAPI, GameModule } from "../engine/types";
import { save } from "../engine/save";
import { isBgmOn, playSound, toggleBgm } from "../engine/audio";
import {
  announce,
  isDismissKey,
  showDialog,
  showResultDialog,
  starsAnnouncement,
  type DialogButton,
  type DialogHandle
} from "./dialogs";
import { createDuoPair } from "./avatars";
import { recordRecent } from "./recent";
import { getLevelExtras, registerLevelExtras, type GuideBook } from "./level188Contract";
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

// ---------------------------------------------------------------------------
// 统一暂停面板(纯数据部分,便于单测)
// ---------------------------------------------------------------------------

export type PauseActionKey = "resume" | "replay" | "guide" | "sound" | "home";

export interface PauseAction {
  key: PauseActionKey;
  label: string;
  kind: "primary" | "ghost";
  /** 开关型按钮的按下态(只有音效按钮有) */
  pressed?: boolean;
  /** 点完不关面板 */
  keepOpen?: boolean;
  ariaLabel?: string;
}

export interface PauseMenuState {
  /** 这一局能不能开攻略(壳层注册了 mountGuide 且这款游戏真有攻略数据) */
  guideAvailable: boolean;
  /** 背景音乐当前开着没 */
  soundOn: boolean;
}

/**
 * 暂停面板的按钮清单:继续 / 重玩 / 攻略 / 音效 / 回首页。
 * 攻略没得看时整颗按钮不出现(而不是灰着让孩子白点)。
 */
export function buildPauseActions(state: PauseMenuState): PauseAction[] {
  const actions: PauseAction[] = [
    { key: "resume", label: "▶️ 继续玩", kind: "primary" },
    { key: "replay", label: "🔁 重玩这一局", kind: "ghost" }
  ];
  if (state.guideAvailable) {
    actions.push({ key: "guide", label: "📖 看攻略", kind: "ghost" });
  }
  actions.push({
    key: "sound",
    label: state.soundOn ? "🎵 音乐:开" : "🔇 音乐:关",
    kind: "ghost",
    pressed: state.soundOn,
    keepOpen: true,
    ariaLabel: state.soundOn ? "关闭背景音乐" : "打开背景音乐"
  });
  actions.push({ key: "home", label: "🏠 回首页", kind: "ghost" });
  return actions;
}

/**
 * 攻略入口到底能不能用。
 *
 * 两个条件缺一不可:
 *  1. 契约里注册了 `mountGuide`(没注册就整条攻略链路都不存在);
 *  2. 真有东西可看 —— 要么这款游戏自带 `guide.ts`,要么 188 关框架已经在
 *     舞台里挂出了攻略按钮(它会用章节信息拼一份兜底攻略)。
 * 只满足第 1 条就放按钮,点开会是一片空白,不如不放。
 */
export function guideAvailable(
  book: GuideBook | null | undefined,
  stageHasGuideButton = false
): boolean {
  if (typeof getLevelExtras().mountGuide !== "function") return false;
  return Boolean(book) || stageHasGuideButton;
}

// ---------------------------------------------------------------------------

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
  // 顶栏标题就是这一页的 h1,读屏软件按标题跳转时能落在这儿
  title.setAttribute("role", "heading");
  title.setAttribute("aria-level", "1");

  const starChip = document.createElement("div");
  starChip.className = "chip star-chip";
  // 星星余额是「分数」,变了要播报;chip 自己也是个 status
  starChip.setAttribute("role", "status");
  starChip.setAttribute("aria-live", "polite");
  const renderStars = (): void => {
    const n = save.getStars();
    starChip.textContent = `⭐ ${n}`;
    starChip.setAttribute("aria-label", starsAnnouncement(n));
  };
  renderStars();
  const unsubscribe = save.onChange(renderStars);

  const duoPair = createDuoPair(38);
  duoPair.title = "朵朵和星星陪你一起玩";
  duoPair.setAttribute("aria-hidden", "true");

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

  // 暂停:键盘按 Esc,手指点这颗按钮,两条路进同一个面板
  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "icon-btn icon-btn--pause";
  pauseBtn.title = "暂停";
  pauseBtn.textContent = "⏸";
  pauseBtn.setAttribute("aria-label", "暂停,打开菜单");
  pauseBtn.setAttribute("aria-haspopup", "dialog");
  pauseBtn.addEventListener("click", () => {
    playSound("tap");
    openPause();
  });

  // 攻略按钮的位置(有攻略数据才会被填上,没有就是个空占位)
  const guideSlot = document.createElement("div");
  guideSlot.className = "guide-slot";

  topbar.append(backBtn, title, duoPair, bgmBtn, guideSlot, pauseBtn, starChip);
  screen.appendChild(topbar);

  gameTitles.set(game.meta.id, game.meta.title);

  // ---- 舞台 ----
  const stage = document.createElement("div");
  stage.className = "game-stage";
  stage.setAttribute("role", "application");
  stage.setAttribute("aria-label", `${game.meta.title} 游戏区`);
  screen.appendChild(stage);

  let mounted: { destroy: () => void } | null = null;
  let dialog: DialogHandle | null = null;
  let pauseDialog: DialogHandle | null = null;
  let finished = false;
  // 异步加载防竞态:每次 start 领一个序号,过期(重开/离开)的结果直接丢弃
  let startSeq = 0;
  let disposed = false;

  // 攻略数据是每款游戏自己的 `guide.ts`,没有这个模块就静默不显示攻略按钮
  let guideCleanup: (() => void) | null = null;
  let guideBook: GuideBook | null = null;
  void loadGuideBook(game.meta.id).then((book) => {
    if (!book || disposed) return;
    guideBook = book;
    guideCleanup = mountGuide(guideSlot, book, () => readCurrentLevel(game.meta.id));
  });

  function closeDialog(): void {
    dialog?.close();
    dialog = null;
  }

  function closePause(): void {
    pauseDialog?.close();
    pauseDialog = null;
  }

  /** 游戏模块自己实现了 pause/resume 就顺手调一下,没实现也不影响面板 */
  function tellGame(method: "pause" | "resume"): void {
    const fn = (mounted as unknown as Record<string, unknown> | null)?.[method];
    if (typeof fn !== "function") return;
    try {
      (fn as () => void).call(mounted);
    } catch (err) {
      console.warn(`[一朵一星] 游戏 ${game.meta.id} ${method} 时出错:`, err);
    }
  }

  /** 页面上现成的攻略按钮:顶栏里的(游戏自带 guide.ts)或选关地图工具行里的 */
  function findGuideTrigger(): HTMLElement | null {
    const btn = screen.querySelector(".guide-btn");
    return btn instanceof HTMLElement ? btn : null;
  }

  function openPause(): void {
    if (disposed || pauseDialog) return;
    tellGame("pause");

    const content = document.createElement("div");
    content.className = "pause-content";
    const h = document.createElement("h2");
    h.className = "dialog-title";
    h.textContent = "先歇一会儿";
    const note = document.createElement("p");
    note.className = "dialog-text";
    note.textContent = "想接着玩就按「继续玩」,按 Esc 也能马上回到游戏。";
    content.append(h, note);

    const actions = buildPauseActions({
      guideAvailable: guideAvailable(guideBook, Boolean(findGuideTrigger())),
      soundOn: isBgmOn()
    });

    const buttons: DialogButton[] = actions.map((action) => ({
      label: action.label,
      kind: action.kind,
      pressed: action.pressed,
      keepOpen: action.keepOpen,
      ariaLabel: action.ariaLabel,
      onClick: () => runPauseAction(action.key)
    }));

    pauseDialog = showDialog({
      className: "dialog--pause",
      content,
      buttons,
      dismissible: true,
      returnFocusTo: pauseBtn,
      onDismiss: () => {
        pauseDialog = null;
        tellGame("resume");
      }
    });
    announce("游戏暂停了");
  }

  function runPauseAction(key: PauseActionKey): void {
    switch (key) {
      case "resume":
        pauseDialog = null;
        playSound("tap");
        tellGame("resume");
        return;
      case "replay":
        pauseDialog = null;
        playSound("tap");
        start();
        return;
      case "guide": {
        pauseDialog = null;
        // 直接复用页面上已有的攻略按钮(顶栏的或 188 关地图里的),
        // 免得同一份抽屉出现两套实现
        const btn = findGuideTrigger();
        if (btn) btn.click();
        else tellGame("resume");
        return;
      }
      case "sound": {
        // keepOpen:原地切换,面板不关,按钮文案与 aria-pressed 一起刷新
        toggleBgm();
        renderBgm();
        refreshPauseSoundButton();
        return;
      }
      case "home":
        pauseDialog = null;
        playSound("tap");
        goHome();
        return;
    }
  }

  function refreshPauseSoundButton(): void {
    const el = pauseDialog?.el;
    if (!el) return;
    const on = isBgmOn();
    for (const btn of Array.from(el.querySelectorAll(".dialog-buttons .btn"))) {
      if (btn.getAttribute("aria-pressed") === null) continue;
      btn.textContent = on ? "🎵 音乐:开" : "🔇 音乐:关";
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-label", on ? "关闭背景音乐" : "打开背景音乐");
    }
    announce(on ? "背景音乐打开了" : "背景音乐关掉了");
  }

  // Esc 统一暂停:游戏自己已经处理过这一下(defaultPrevented)就让给游戏
  function onGlobalKeyDown(e: KeyboardEvent): void {
    if (disposed || !isDismissKey(e.key) || e.defaultPrevented) return;
    // 弹窗自己会吃掉 Esc(捕获阶段),走到这里说明当前没有打开的弹窗
    if (dialog || pauseDialog) return;
    e.preventDefault();
    openPause();
  }
  document.addEventListener("keydown", onGlobalKeyDown);

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
    stage.innerHTML = `<div class="empty-state" role="alert"><div class="empty-emoji" aria-hidden="true">🛠️</div><p>这个游戏出了点小问题,先玩别的吧!</p></div>`;
  }

  function start(): void {
    const seq = ++startSeq;
    closeDialog();
    closePause();
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
          onHome: goHome,
          returnFocusTo: pauseBtn,
          onDismiss: () => {
            dialog = null;
          }
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
          onHome: goHome,
          returnFocusTo: pauseBtn,
          onDismiss: () => {
            dialog = null;
          }
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
    document.removeEventListener("keydown", onGlobalKeyDown);
    closeDialog();
    closePause();
    unmount();
    guideCleanup?.();
    guideCleanup = null;
    guideBook = null;
    unsubscribe();
    screen.remove();
  };
}
