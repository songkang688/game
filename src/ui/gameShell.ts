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
import {
  INTRO_HOLD_MS,
  INTRO_LEAVE_MS,
  SCORE_ROLL_MS,
  STAR_BASE_MS,
  STAR_STEP_MS,
  motionPref,
  staggerDelays,
  tweenNumber
} from "./motion";

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
// 1.3 第 1 步 B · 关卡壳视觉层:入场卡与结算舞台动效(纯 DOM 装配,可注入桩单测)
// ---------------------------------------------------------------------------

/** 入场卡的大字:闯关游戏是「第 N 关」,没有关卡概念的游戏用游戏名顶上 */
export function introHeading(level: number, title: string): string {
  return Number.isFinite(level) && level >= 1 ? `第 ${Math.floor(level)} 关` : title;
}

export interface LevelIntroOptions {
  /** 当前关(1 基);≤0 表示这款没有闯关概念,大字改用 title */
  level: number;
  /** 游戏名(level ≤ 0 时的大字) */
  title: string;
  /** 一句目标文案(沿用 meta.blurb,不新造文案) */
  goal: string;
  /** 装饰图形:游戏自己的表情图标 */
  emoji: string;
  /** 减弱动效:立即静态显示,不弹入不离场 */
  reduced: boolean;
}

/**
 * 「第 N 关 + 目标」入场卡(视觉层,pointer-events 一律穿透,绝不挡操作)。
 * 时长口径见 motion.ts:INTRO_HOLD_MS 后让位,INTRO_LEAVE_MS 内退场。
 */
export function buildLevelIntroCard(doc: Document, opts: LevelIntroOptions): HTMLElement {
  const wrap = doc.createElement("div");
  wrap.className = `level-intro${opts.reduced ? " level-intro--static" : ""}`;
  // 转瞬即逝的装饰卡:读屏用户听壳层的 announce,不让焦点/朗读追着它跑
  wrap.setAttribute("aria-hidden", "true");

  const card = doc.createElement("div");
  card.className = "level-intro-card";

  const decor = doc.createElement("span");
  decor.className = "level-intro-decor";
  decor.textContent = opts.emoji;

  const heading = doc.createElement("span");
  heading.className = "level-intro-level";
  heading.textContent = introHeading(opts.level, opts.title);

  const goal = doc.createElement("span");
  goal.className = "level-intro-goal";
  goal.textContent = opts.goal;

  card.append(decor, heading, goal);
  wrap.appendChild(card);
  return wrap;
}

export interface ResultMotionOptions {
  /** 这一局拿到的星数(1–3) */
  stars: number;
  /** 减弱动效:星星直接亮、分数直接显示 */
  reduced: boolean;
  /** 单测注入;缺省 requestAnimationFrame(拿不到就直接显示终值) */
  raf?: ((fn: () => void) => unknown) | null;
  /** 单测注入;缺省 performance.now */
  now?: () => number;
}

/**
 * 结算舞台的动效装配(视觉层,不改 dialogs 的结构与文案):
 *  1. 星级逐颗点亮:把星位的动画延迟改写成 STAR_BASE_MS + i·STAR_STEP_MS(~250ms 一颗);
 *  2. 分数滚动:在星位下面加一枚「+N ⭐」胶囊,数字从 0 滚到实际星数(≤ SCORE_ROLL_MS)。
 * reduced 时延迟全 0、数字直接是终值。失败结算没有星位,整段静默跳过。
 */
export function applyResultMotion(dialogEl: HTMLElement | null, opts: ResultMotionOptions): void {
  if (!dialogEl?.querySelectorAll) return;

  const delays = staggerDelays(3, STAR_STEP_MS, opts.reduced);
  const stars = Array.from(dialogEl.querySelectorAll(".result-stars .star"));
  stars.forEach((el, i) => {
    const star = el as HTMLElement;
    const ms = opts.reduced ? 0 : STAR_BASE_MS + (delays[i] ?? 0);
    star.style.animationDelay = `${ms / 1000}s`;
  });

  const starRow = dialogEl.querySelector(".result-stars");
  if (!starRow?.parentElement) return;

  const n = Number.isFinite(opts.stars) ? Math.max(0, Math.min(3, Math.floor(opts.stars))) : 0;
  const doc = dialogEl.ownerDocument;
  if (!doc) return;
  const score = doc.createElement("span");
  score.className = "result-score";
  // announce() 已经把「拿到 N 颗星星」念过了,这枚滚动数字纯属视觉
  score.setAttribute("aria-hidden", "true");
  starRow.parentElement.insertBefore(score, starRow.nextSibling);

  const raf =
    opts.raf !== undefined
      ? opts.raf
      : typeof requestAnimationFrame === "function"
        ? (fn: () => void) => requestAnimationFrame(fn)
        : null;
  const nowFn =
    opts.now ?? (typeof performance !== "undefined" ? () => performance.now() : () => Date.now());

  if (opts.reduced || typeof raf !== "function") {
    score.textContent = `+${n} ⭐`;
    return;
  }

  const t0 = nowFn();
  const tick = (): void => {
    // 弹窗关掉(整棵树被摘走)就停,不留幽灵动画
    if (score.isConnected === false) return;
    const t = (nowFn() - t0) / SCORE_ROLL_MS;
    score.textContent = `+${Math.round(tweenNumber(0, n, t))} ⭐`;
    if (t < 1) raf(tick);
  };
  tick();
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

  /**
   * Esc 统一暂停。
   *
   * 挂在 window 上、并且推迟一个宏任务再判断,是因为自带暂停的游戏
   * (噗噗超人、冒险小王、寻找外星朋友…)也把 keydown 挂在 window 上并
   * `preventDefault()`。同一目标同一阶段按注册顺序触发,壳层永远先注册,
   * 立刻处理就会和游戏各弹一次暂停。等这一轮派发结束再看 `defaultPrevented`,
   * 谁先接住就归谁。
   *
   * 弹窗开着时 `showDialog` 在捕获阶段就把 Esc 吃掉了(还 stopPropagation),
   * 这里根本收不到。
   */
  function onGlobalKeyDown(e: KeyboardEvent): void {
    if (disposed || !isDismissKey(e.key)) return;
    if (dialog || pauseDialog) return;
    window.setTimeout(() => {
      if (disposed || dialog || pauseDialog || e.defaultPrevented) return;
      openPause();
    }, 0);
  }
  window.addEventListener("keydown", onGlobalKeyDown);

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

  // ---- 入场卡:「第 N 关」+ 目标,INTRO_HOLD_MS 后自动让位(reduced 立即静态) ----
  let introEl: HTMLElement | null = null;
  let introTimers: number[] = [];

  function clearIntro(): void {
    for (const t of introTimers) window.clearTimeout(t);
    introTimers = [];
    introEl?.remove();
    introEl = null;
  }

  function showIntro(): void {
    clearIntro();
    const reduced = motionPref();
    // 只有闯关游戏才有「第 N 关」;当前关只读存档,读不到就是第 1 关
    const level = game.meta.levels ? readCurrentLevel(game.meta.id) : 0;
    introEl = buildLevelIntroCard(document, {
      level,
      title: game.meta.title,
      goal: game.meta.blurb,
      emoji: game.meta.emoji,
      reduced
    });
    // 挂在 screen 上而不是舞台里:游戏挂载时会清空 stage.innerHTML,别把卡片一起洗掉
    screen.appendChild(introEl);
    introTimers.push(
      window.setTimeout(() => {
        if (!introEl) return;
        if (reduced) {
          // 减弱动效:不播离场动画,静态显示满时长后直接摘掉
          clearIntro();
          return;
        }
        introEl.classList.add("level-intro--leave");
        introTimers.push(window.setTimeout(clearIntro, INTRO_LEAVE_MS + 80));
      }, INTRO_HOLD_MS)
    );
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
    showIntro();

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
        // 结算舞台动效:星级 ~250ms 逐颗点亮 + 分数滚动(reduced 直接亮、直接显示)
        applyResultMotion(dialog.el, { stars, reduced: motionPref() });
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
    window.removeEventListener("keydown", onGlobalKeyDown);
    closeDialog();
    closePause();
    clearIntro();
    unmount();
    guideCleanup?.();
    guideCleanup = null;
    guideBook = null;
    unsubscribe();
    screen.remove();
  };
}
