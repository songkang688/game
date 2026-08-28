/**
 * 弹弹小鸟 —— 拉开大弹弓,把捣蛋的绿绿豆全都弹走!
 *
 * - 188 关、9 个主题世界选关地图,通关解锁,可回放刷 3 星
 * - 1.2 补做无尽「打靶塔」:一轮比一轮高,塔倒得越多分越高
 * - 5 种原创小鸟技能:糯糯(直球)/ 云云(分裂)/ 墩墩(下砸)/ 闪闪(加速钻)/ 卷卷(回旋)
 * - 1.1 机制:传送门(钻进去从另一口飞出)、岩壳块(要连敲两次才碎)
 * - 自写 2D 弹弓 + 重力 + 方块破坏物理,不用任何物理引擎
 *
 * 1.2 起物理与实体都在 world.ts(纯模块、固定步长),这里只管渲染 / 输入 / HUD,
 * 单测和关卡可解性模拟跑的是同一套物理。
 */
import { meta } from "./meta";
export { meta };

import {
  CHAPTERS,
  LEVELS,
  chapterStartId,
  levelsOfChapter,
  type BirdKind,
  type BlockKind,
  type LevelDef,
  type PortalDef,
  type SlopeDef,
  type WindDef
} from "./levels";
import {
  SHARD_COLORS,
  WIN_LEAP_H,
  beanVariant,
  drawBannerBadge,
  drawBeanArt,
  drawBirdArt,
  drawBlockArt,
  drawGrassStrip,
  drawMidground,
  drawShard,
  drawShockRing,
  drawSlingshotArt,
  drawSparklePoint,
  drawWinSparkle,
  shardShapeFor,
  winLeapPhase,
  type BeanVariant,
  type BirdMood,
  type ShardShape
} from "./art";
import {
  GRAVITY,
  GROUND_Y,
  MAX_DRAG,
  SLING_X,
  SLING_Y,
  WORLD_H,
  WORLD_W,
  calcStars,
  canvasBufferHeight,
  clamp,
  launchVelocity,
  padSplit
} from "./physics";
import { BIRD_INFO, SKILL_WINDOW_END, canTriggerSkill } from "./birds";
import { MAT } from "./materials";
import {
  FINGER_GAP,
  MIN_DRAG,
  bandTension,
  dragFromPointer,
  grabOffset,
  previewDotCount,
  previewDots,
  releaseStretch,
  type GrabOffset
} from "./aim";
import {
  ENDLESS_BIRDS,
  endlessLine,
  roundScore,
  towerRound,
  type EndlessRound
} from "./endless";
import {
  advance,
  allBirdsDone,
  beansAlive as worldBeansAlive,
  createWorld,
  launchBird,
  makeBird,
  triggerSkill as worldTriggerSkill,
  worldCalm,
  type RtBird,
  type World,
  type WorldSound,
  type WorldSource
} from "./world";
import { save } from "../../engine/save";
import { isRootOpen } from "../../ui/root12Contract";
import { unlockedWithRoot } from "./rootUnlock";
import { speak, stopSpeaking, whenSpeechReady } from "../speech";

type SoundName = WorldSound;

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

/* ---------------- 本地进度(独立存档,不动平台存档) ---------------- */

const STORE_KEY = "yiduo-yixing.sling-birds.v2";

interface Progress {
  stars: Record<string, number>;
  resume: number | null;
  chapter: number;
}

function loadProgress(): Progress {
  const fallback: Progress = { stars: {}, resume: null, chapter: 0 };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return fallback;
    const obj = JSON.parse(raw) as Partial<Progress>;
    const stars: Record<string, number> = {};
    if (obj.stars && typeof obj.stars === "object") {
      for (const [k, v] of Object.entries(obj.stars)) {
        const n = Number(v);
        if (Number.isFinite(n)) stars[k] = clamp(Math.round(n), 0, 3);
      }
    }
    return {
      stars,
      resume: typeof obj.resume === "number" ? obj.resume : null,
      chapter:
        typeof obj.chapter === "number"
          ? clamp(Math.round(obj.chapter), 0, CHAPTERS.length - 1)
          : 0
    };
  } catch {
    return fallback;
  }
}

function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    // 隐私模式等场景静默失败,进度只在本次会话内有效
  }
}

/* ---------------- 运行时实体(小鸟/方块/豆子等都在 world.ts) ---------------- */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  /** 碎片形状(1.3:材质碎片查表,不再是纯色方块/圆) */
  shape: ShardShape;
  rot: number;
  /** 自转角速度(rad/s) */
  vr: number;
}

/** 扩散圆环:TNT 冲击波(0.25s)与技能触发白闪圈(0.12s) */
interface Ring {
  x: number;
  y: number;
  t: number;
  dur: number;
  max: number;
}

/** 豆豆被击中的 0.2s「惊讶脸」残影 */
interface BeanGhost {
  x: number;
  y: number;
  t: number;
  variant: BeanVariant;
}

/** 世界层 burst 配色 → 方块材质的反查表(渲染层识别「谁碎了」用) */
const FILL_TO_KIND: Record<string, BlockKind> = {};
for (const [k, m] of Object.entries(MAT)) FILL_TO_KIND[m.fill] = k as BlockKind;

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let nextTowerTimer = 0;
  let lastTime = 0;

  const progress = loadProgress();

  /* ---------------- DOM ---------------- */

  const wrap = document.createElement("div");
  wrap.className = "slb-wrap";
  wrap.innerHTML = `
    <style>
      /* 布局:竖屏时游戏区填满舞台,不再在画布下方留一大片空白(三人组 R2 遗留) */
      .slb-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EAF6FF, #FFF4F9); border-radius: 20px; padding: 12px; max-width: 640px; margin: 0 auto; user-select: none; -webkit-user-select: none; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; overflow-y: auto; }
      .slb-play { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
      /* 画布绝对定位脱离布局流:自身尺寸不反过来影响舞台测量(避免布局反馈环) */
      .slb-stagebox { flex: 1; min-height: 180px; position: relative; overflow: hidden; }
      /* 文字对比度按 WCAG AA 实测调深:徽章 4.0→6.0、提示 2.8→5.2(小字最小 14px) */
      .slb-badge { background: #fff; border-radius: 14px; padding: 6px 10px; font-weight: 700; color: #40658F; box-shadow: 0 2px 6px rgba(120,160,220,.25); font-size: 14px; white-space: nowrap; }
      .slb-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap; }
      .slb-canvas { position: absolute; inset: 0; margin: auto; border-radius: 16px; display: block; touch-action: none; cursor: crosshair; }
      .slb-ctrl { display: flex; justify-content: center; gap: 12px; }
      /* 按钮热区 ≥48px,一年级手指点得准 */
      .slb-btn { border: none; border-radius: 16px; font-size: 16px; font-weight: 800; padding: 12px 22px; min-height: 48px; background: #BFE0FB; color: #2F5D8A; cursor: pointer; box-shadow: 0 4px 0 #97C4EC; touch-action: manipulation; font-family: inherit; }
      .slb-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #97C4EC; }
      /* 教练卡:当前小鸟是谁、技能怎么用,大字 + 可朗读(识字量 300–800 字的孩子靠听) */
      .slb-coach { display: flex; align-items: center; gap: 10px; background: #fff; border-radius: 16px; padding: 9px 12px; box-shadow: 0 2px 8px rgba(120,160,220,.22); }
      .slb-coach-dot { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(255,255,255,.9); box-shadow: 0 2px 5px rgba(0,0,0,.18); }
      .slb-coach-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .slb-coach-name { font-size: 15px; font-weight: 900; color: #574C8F; line-height: 1.2; }
      .slb-coach-text { font-size: 15px; font-weight: 700; color: #4A5568; line-height: 1.35; }
      .slb-say { flex: 0 0 auto; border: none; border-radius: 14px; width: 46px; height: 46px; font-size: 21px; background: #EAF2FD; cursor: pointer; box-shadow: 0 3px 0 #C6DCF5; touch-action: manipulation; }
      .slb-say:active { transform: translateY(2px); box-shadow: 0 1px 0 #C6DCF5; }
      .slb-dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; margin: 0 1px; vertical-align: -2px; border: 2px solid rgba(255,255,255,.9); box-shadow: 0 1px 3px rgba(0,0,0,.15); }
      .slb-map-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
      .slb-map-title { font-size: 20px; font-weight: 900; color: #4C7DB3; }
      .slb-tabs { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
      .slb-tab { flex: 1; min-width: 110px; min-height: 44px; border: none; border-radius: 16px; padding: 10px 6px; font-size: 14px; font-weight: 800; cursor: pointer; color: #56637F; background: #fff; box-shadow: 0 3px 0 rgba(150,170,210,.35); font-family: inherit; }
      /* 激活页签改「彩底深字白描边」(与 l99 地图一致):原白字浅底只有 2.1:1 */
      .slb-tab.slb-on { color: #3D3660; background: linear-gradient(135deg, #BFE0FB, #D9CCF7); outline: 3px solid #fff; box-shadow: 0 3px 8px rgba(140,120,200,.3); }
      .slb-tab:disabled { opacity: .55; cursor: not-allowed; }
      .slb-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
      .slb-cell { position: relative; border: none; border-radius: 14px; aspect-ratio: 1; font-size: 17px; font-weight: 900; cursor: pointer; background: #fff; color: #3E6D9E; box-shadow: 0 3px 0 rgba(150,170,210,.35); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 2px; font-family: inherit; }
      .slb-cell:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(150,170,210,.35); }
      .slb-cell.slb-lock { background: #E9EDF5; color: #A9B4C8; cursor: not-allowed; }
      .slb-cell.slb-next { background: linear-gradient(135deg, #FFE9A8, #FFC9DC); color: #6E4523; }
      .slb-cell .slb-stars { font-size: 9px; letter-spacing: -1px; line-height: 1; }
      /* 无尽打靶塔入口:整行大按钮,热区远超 44px,360px 上也不会挤成两行 */
      .slb-endless { display: block; width: 100%; min-height: 48px; border: none; border-radius: 16px; margin-bottom: 12px; padding: 12px 10px; font-size: 16px; font-weight: 900; color: #6E4523; background: linear-gradient(135deg, #FFE9A8, #FFC9DC); box-shadow: 0 4px 0 #E9B9C9; cursor: pointer; font-family: inherit; touch-action: manipulation; }
      .slb-endless:active { transform: translateY(3px); box-shadow: 0 1px 0 #E9B9C9; }
      .slb-map-tip { text-align: center; color: #5E6880; font-weight: 700; font-size: 14px; margin-top: 12px; }
      .slb-crew { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; justify-content: center; }
      .slb-crew span { background: #fff; border-radius: 12px; padding: 5px 9px; font-size: 12px; font-weight: 700; color: #56637F; box-shadow: 0 2px 5px rgba(120,160,220,.2); }
    </style>
    <div class="slb-map">
      <div class="slb-map-head">
        <span class="slb-map-title">🐦 弹弹小鸟</span>
        <span class="slb-badge slb-total">⭐ 0/564</span>
      </div>
      <button class="slb-endless" type="button">♾️ 无尽打靶塔</button>
      <div class="slb-tabs"></div>
      <div class="slb-grid"></div>
      <div class="slb-map-tip">打赢一关就解锁下一关,集满 3 星可以随时回来再挑战!</div>
      <div class="slb-crew">
        <span style="color:#9A4E6C">🩷 糯糯·直球</span>
        <span style="color:#655388">💜 云云·分裂</span>
        <span style="color:#3F6B8F">💙 墩墩·下砸</span>
        <span style="color:#8A5F2C">🧡 闪闪·加速钻</span>
        <span style="color:#3E7A55">💚 卷卷·回旋</span>
      </div>
    </div>
    <div class="slb-play" style="display:none">
      <div class="slb-top">
        <span class="slb-badge slb-lvl"></span>
        <span class="slb-badge slb-birds"></span>
        <span class="slb-badge slb-beans"></span>
      </div>
      <div class="slb-stagebox">
        <canvas class="slb-canvas" width="${WORLD_W}" height="${WORLD_H}"></canvas>
      </div>
      <div class="slb-coach">
        <span class="slb-coach-dot" aria-hidden="true"></span>
        <div class="slb-coach-body">
          <b class="slb-coach-name"></b>
          <span class="slb-coach-text"></span>
        </div>
        <button class="slb-say" type="button" hidden aria-label="再听一遍">🔈</button>
      </div>
      <div class="slb-ctrl">
        <button class="slb-btn slb-retry" type="button">↺ 重来</button>
        <button class="slb-btn slb-back" type="button">🗺️ 选关</button>
      </div>
    </div>
  `;
  api.root.appendChild(wrap);

  const mapView = wrap.querySelector(".slb-map") as HTMLElement;
  const playView = wrap.querySelector(".slb-play") as HTMLElement;
  const tabsEl = wrap.querySelector(".slb-tabs") as HTMLElement;
  const gridEl = wrap.querySelector(".slb-grid") as HTMLElement;
  const totalEl = wrap.querySelector(".slb-total") as HTMLElement;
  const stageBox = wrap.querySelector(".slb-stagebox") as HTMLElement;
  const canvas = wrap.querySelector(".slb-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  const lvlEl = wrap.querySelector(".slb-lvl") as HTMLElement;
  const birdsEl = wrap.querySelector(".slb-birds") as HTMLElement;
  const beansEl = wrap.querySelector(".slb-beans") as HTMLElement;
  const coachDotEl = wrap.querySelector(".slb-coach-dot") as HTMLElement;
  const coachNameEl = wrap.querySelector(".slb-coach-name") as HTMLElement;
  const msgEl = wrap.querySelector(".slb-coach-text") as HTMLElement;
  const sayBtn = wrap.querySelector(".slb-say") as HTMLButtonElement;
  const retryBtn = wrap.querySelector(".slb-retry") as HTMLButtonElement;
  const backBtn = wrap.querySelector(".slb-back") as HTMLButtonElement;
  const endlessBtn = wrap.querySelector(".slb-endless") as HTMLButtonElement;

  /* ---------------- 画布竖屏自适应(R2 遗留:下方留白偏大) ----------------
   * 宽度固定映射 WORLD_W;竖屏时缓冲高度按舞台比例延展,
   * 上方多出来的是天空(高弧线不再飞出画面),下方垫一条泥土装饰。 */

  let bufH = WORLD_H;
  let skyPad = 0;
  let groundPad = 0;

  function measureCanvas(): void {
    const bw = stageBox.clientWidth;
    const bh = stageBox.clientHeight;
    if (!(bw > 0) || !(bh > 0)) return;
    const next = canvasBufferHeight(bw, bh);
    const scale = Math.min(bw / WORLD_W, bh / next);
    canvas.style.width = `${Math.floor(WORLD_W * scale)}px`;
    canvas.style.height = `${Math.floor(next * scale)}px`;
    if (next !== bufH || canvas.height !== next) {
      bufH = next;
      const pads = padSplit(next);
      skyPad = pads.sky;
      groundPad = pads.ground;
      canvas.height = next;
    }
  }

  window.addEventListener("resize", measureCanvas);
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(measureCanvas);
    resizeObserver.observe(stageBox);
  }

  /* ---------------- 教练卡与朗读 ---------------- */

  // 每关第一只小鸟、以及换了不同种类的小鸟时自动念技能口诀;同种连发不重复念
  let lastSpokenKind: BirdKind | null = null;

  function setCoach(kind: BirdKind): void {
    const info = BIRD_INFO[kind];
    coachDotEl.style.background = `radial-gradient(circle at 32% 30%, ${info.belly}, ${info.color})`;
    coachDotEl.style.borderColor = "rgba(255,255,255,.9)";
    coachDotEl.style.boxShadow = `0 2px 5px rgba(0,0,0,.18), inset 0 0 0 1.5px ${info.dark}`;
    coachNameEl.textContent = `${info.name} · ${info.skill}`;
    msgEl.textContent = info.hint;
    if (kind !== lastSpokenKind) {
      lastSpokenKind = kind;
      speak(info.hint);
    }
  }

  sayBtn.addEventListener("click", () => {
    const line = msgEl.textContent;
    if (line) speak(line);
  });
  const unwatchSpeech = whenSpeechReady(() => {
    sayBtn.hidden = false;
  });

  /* ---------------- 进度辅助 ---------------- */

  function starsOf(id: number): number {
    return progress.stars[String(id)] ?? 0;
  }

  function isUnlocked(id: number): boolean {
    // 管理员权限(kangkang 密码)开着时全关可进;关着/过期回落到星级解锁
    return unlockedWithRoot(isRootOpen(), id === 1 || starsOf(id - 1) > 0);
  }

  function chapterUnlocked(c: number): boolean {
    return isUnlocked(chapterStartId(c));
  }

  /* ---------------- 选关地图 ---------------- */

  function renderMap(): void {
    const total = LEVELS.reduce((s, l) => s + starsOf(l.id), 0);
    totalEl.textContent = `⭐ ${total}/${LEVELS.length * 3}`;
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽打靶塔 · 最好 ${best} 分` : "♾️ 无尽打靶塔";

    tabsEl.innerHTML = "";
    for (let c = 0; c < CHAPTERS.length; c++) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "slb-tab" + (c === progress.chapter ? " slb-on" : "");
      const open = chapterUnlocked(c);
      tab.textContent = `${CHAPTERS[c].emoji} ${CHAPTERS[c].name}${open ? "" : " 🔒"}`;
      tab.disabled = !open;
      tab.addEventListener("click", () => {
        api.play("tap");
        progress.chapter = c;
        saveProgress(progress);
        renderMap();
      });
      tabsEl.appendChild(tab);
    }

    gridEl.innerHTML = "";
    for (const l of levelsOfChapter(progress.chapter)) {
      const cell = document.createElement("button");
      cell.type = "button";
      const open = isUnlocked(l.id);
      const st = starsOf(l.id);
      cell.className =
        "slb-cell" + (!open ? " slb-lock" : st === 0 ? " slb-next" : "");
      cell.innerHTML = open
        ? `<span>${l.id}</span><span class="slb-stars">${"★".repeat(st)}${"☆".repeat(3 - st)}</span>`
        : `<span>🔒</span>`;
      cell.title = l.name;
      cell.disabled = !open;
      cell.addEventListener("click", () => {
        if (!isUnlocked(l.id)) return;
        api.play("tap");
        openLevel(l.id);
      });
      gridEl.appendChild(cell);
    }
  }

  function showMap(): void {
    stopSpeaking();
    progress.resume = null;
    saveProgress(progress);
    level = null;
    endlessRound = null;
    mode = "campaign";
    playView.style.display = "none";
    mapView.style.display = "";
    renderMap();
  }

  /* ---------------- 关卡运行时状态 ---------------- */

  /** 当前是闯关还是无尽打靶塔 */
  let mode: "campaign" | "endless" = "campaign";
  /** 闯关关卡(无尽时为 null),chapter 决定画面配色 */
  let level: LevelDef | null = null;
  let endlessRound: EndlessRound | null = null;
  let endlessScore = 0;
  let endlessBest = 0;

  let world: World = createWorld({ blocks: [], beans: [] });
  let particles: Particle[] = [];
  let rings: Ring[] = [];
  let beanGhosts: BeanGhost[] = [];
  let featherT = 0;
  let queue: BirdKind[] = [];
  let loadedBird: RtBird | null = null;

  let phase: "aim" | "fly" | "won" | "lost" = "aim";
  let shake = 0;
  let introT = 0;
  let endT = 0;
  let nextBirdT = 0;
  let loseWaitT = 0;
  let finishSent = false;
  let launchT = 99;
  let lastSound: Record<string, number> = {};

  let aiming = false;
  let aimPointer = -1;
  let dragX = 0;
  let dragY = 0;
  let grabOff: GrabOffset = { ox: 0, oy: FINGER_GAP };
  let fingerX = 0;
  let fingerY = 0;

  // 画质:开了「减少动态效果」就少放粒子(结果照旧,只是不闪)
  const reduceMotion =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const quality = reduceMotion ? 0.35 : 1;

  function playThrottled(name: SoundName, gap = 0.07): void {
    if (world.simT - (lastSound[name] ?? -1) < gap) return;
    lastSound[name] = world.simT;
    api.play(name);
  }

  /** 世界给渲染层的钩子:粒子、音效、震屏、HUD 刷新 */
  const worldFx = {
    burst: (x: number, y: number, colors: string[], count: number, speed: number, square: boolean) =>
      fancyBurst(x, y, colors, count, speed, square),
    sound: (name: SoundName, gap: number) => playThrottled(name, gap),
    shake: (amount: number) => {
      shake = Math.max(shake, reduceMotion ? amount * 0.3 : amount);
    },
    changed: () => updateHud()
  };

  /** 场景通用的开局:建世界、清粒子、把小鸟排上队 */
  function startScene(src: WorldSource & { birds: BirdKind[] }): void {
    // 新开一幕就作废上一座塔排队中的自动续关,免得退出再进时凭空跳一轮
    window.clearTimeout(nextTowerTimer);
    nextTowerTimer = 0;
    world = createWorld(src, worldFx, quality);
    particles = [];
    rings = [];
    beanGhosts = [];
    featherT = 0;
    queue = [...src.birds];
    loadedBird = null;
    phase = "aim";
    shake = 0;
    introT = 2;
    endT = 0;
    nextBirdT = 0;
    loseWaitT = 0;
    launchT = 99;
    finishSent = false;
    lastSound = {};
    aiming = false;
    dragX = 0;
    dragY = 0;

    mapView.style.display = "none";
    playView.style.display = "";
    measureCanvas();
    loadNextBird(false);
    updateHud();
  }

  function openLevel(id: number): void {
    const def = LEVELS.find((l) => l.id === id);
    if (!def) {
      showMap();
      return;
    }
    // 换到别的关才重置朗读记忆:同一关反复重试不重复念口诀(想再听点 🔈)
    if (!level || level.id !== def.id) lastSpokenKind = null;
    mode = "campaign";
    level = def;
    endlessRound = null;
    progress.resume = id;
    progress.chapter = def.chapter;
    saveProgress(progress);
    startScene(def);
  }

  /** 平台「直达第 N 关」的入口:自建地图的游戏按第 9 节要求提供这个 */
  function openCampaignLevel(n: number): boolean {
    const target = LEVELS.find((l) => l.id === n);
    if (!target) return false;
    openLevel(target.id);
    return true;
  }

  /** 无尽「打靶塔」:开第 round 座塔 */
  function openEndlessRound(round: number): void {
    mode = "endless";
    level = null;
    lastSpokenKind = null;
    endlessRound = towerRound(round);
    startScene(endlessRound);
  }

  function startEndless(): void {
    endlessScore = 0;
    endlessBest = save.getGameProgress(meta.id).endlessBest;
    openEndlessRound(1);
  }

  function loadNextBird(chirp: boolean): void {
    const kind = queue.shift();
    if (!kind) {
      loadedBird = null;
      return;
    }
    loadedBird = makeBird(kind);
    loadedBird.x = SLING_X;
    loadedBird.y = SLING_Y;
    phase = "aim";
    if (chirp) playThrottled("meow", 0.3);
    setCoach(kind);
    updateHud();
  }

  /* ---------------- HUD ---------------- */

  function beansAlive(): number {
    return worldBeansAlive(world);
  }

  /** 当前场景的章节配色(无尽轮换着换风景) */
  function sceneChapter(): number {
    return level ? level.chapter : (endlessRound?.chapter ?? 0);
  }

  function updateHud(): void {
    if (mode === "endless") {
      const r = endlessRound?.round ?? 1;
      lvlEl.textContent = `♾️ ${CHAPTERS[sceneChapter()].emoji} 第 ${r} 座打靶塔`;
    } else if (level) {
      lvlEl.textContent = `${CHAPTERS[level.chapter].emoji} 第${level.id}关 ${level.name}`;
    } else {
      return;
    }
    const kinds: BirdKind[] = [];
    if (loadedBird && !loadedBird.flying) kinds.push(loadedBird.kind);
    kinds.push(...queue);
    birdsEl.innerHTML =
      "🐦 " +
      (kinds.length === 0
        ? "—"
        : kinds.map((k) => `<i class="slb-dot" style="background:${BIRD_INFO[k].color}"></i>`).join(""));
    beansEl.textContent =
      mode === "endless" ? `🟢 剩 ${beansAlive()} · 🏆 ${endlessScore}` : `🟢 剩 ${beansAlive()} 颗`;
  }

  /* ---------------- 粒子与特效 ---------------- */

  function spawnBurst(x: number, y: number, colors: string[], count: number, speed: number, shape: ShardShape): void {
    if (particles.length > 260) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.75);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.35,
        life: 0.55 + Math.random() * 0.35,
        maxLife: 0.9,
        size: shape === "dot" ? 2 + Math.random() * 3 : 3 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape,
        rot: shape === "dot" ? 0 : Math.random() * Math.PI * 2,
        vr: shape === "dot" ? 0 : (Math.random() - 0.5) * 10
      });
    }
  }

  /** 材质碎片:木长条 / 石四边形 / 冰玻璃三角 / 岩壳圆石 / 晶核菱片 / TNT 火花,每种 ≤6 粒,弱动效减半 */
  function spawnShards(kind: BlockKind, x: number, y: number, speed: number): void {
    spawnBurst(x, y, SHARD_COLORS[kind], reduceMotion ? 3 : 6, speed, shardShapeFor(kind));
  }

  /** 豆豆被击中:0.2s 惊讶脸残影 + 4 粒绿星屑 + 1 片叶子飘落(弱动效只留淡出的脸) */
  function spawnBeanPop(x: number, y: number): void {
    const idx = world.beans.findIndex((b) => b.x === x && b.y === y);
    beanGhosts.push({ x, y, t: 0, variant: beanVariant(idx < 0 ? 0 : idx) });
    if (reduceMotion) return;
    spawnBurst(x, y, ["#A5D96C", "#7FBF4D", "#D3F0A8"], 4, 130, "star");
    particles.push({
      x,
      y,
      vx: 18,
      vy: -46,
      life: 0.8,
      maxLife: 0.9,
      size: 4,
      color: "#6FAE45",
      shape: "leaf",
      rot: 0.4,
      vr: 2.4
    });
  }

  /**
   * 世界层 burst 的渲染派发:按配色识别事件——
   * 方块碎裂(square)→ 材质碎片;豆豆被弹走 → 惊讶脸演出;
   * TNT 爆炸 → 白色冲击波环 + 星形火花(无火焰恐怖感);其余保持圆点星屑。
   */
  function fancyBurst(x: number, y: number, colors: string[], count: number, speed: number, square: boolean): void {
    if (square) {
      const kind = FILL_TO_KIND[colors[0]];
      if (kind) {
        spawnShards(kind, x, y, speed);
        return;
      }
    } else if (colors[0] === "#A5D96C") {
      spawnBeanPop(x, y);
      return;
    } else if (colors[0] === "#FFB864") {
      if (!reduceMotion) rings.push({ x, y, t: 0, dur: 0.25, max: 64 });
      spawnBurst(x, y, SHARD_COLORS.tnt, reduceMotion ? 5 : 10, speed, "spark");
      return;
    }
    spawnBurst(x, y, colors, count, speed, square ? "quad" : "dot");
  }

  function birdsRemaining(): number {
    return queue.length + (loadedBird && !loadedBird.flying ? 1 : 0);
  }

  /** 这一轮打靶塔的得分(塔倒得越多分越高) */
  function tallyEndless(cleared: boolean): number {
    return roundScore({
      round: endlessRound?.round ?? 1,
      destroyed: world.destroyed,
      popped: world.beans.filter((b) => b.dead).length,
      birdsLeft: birdsRemaining(),
      cleared
    });
  }

  function finishWin(): void {
    if (finishSent) return;
    if (mode === "endless") {
      // 无尽:清台就加分进下一座塔,不弹结算面板
      finishSent = true;
      endlessScore += tallyEndless(true);
      const next = (endlessRound?.round ?? 1) + 1;
      msgEl.textContent = `这座塔全倒啦!当前 ${endlessScore} 分,下一座更高!`;
      playThrottled("win", 0);
      window.clearTimeout(nextTowerTimer);
      nextTowerTimer = window.setTimeout(() => {
        nextTowerTimer = 0;
        if (!destroyed && mode === "endless") openEndlessRound(next);
      }, 700);
      return;
    }
    if (!level) return;
    finishSent = true;
    const left = birdsRemaining();
    const ratio = world.totalDestructible > 0 ? world.destroyed / world.totalDestructible : 1;
    const stars = calcStars(left, ratio);
    const key = String(level.id);
    progress.stars[key] = Math.max(progress.stars[key] ?? 0, stars);
    const next = LEVELS.find((l) => l.id === level!.id + 1);
    progress.resume = next ? next.id : null;
    saveProgress(progress);
    msgEl.textContent = "🎉 绿绿豆全被弹走啦!";
    const detail =
      left >= 2
        ? `还省下 ${left} 只小鸟,每一发都打在了关键点上!`
        : left === 1
          ? "还留了一只小鸟备用,落点算得很准!"
          : `破坏率 ${Math.round(ratio * 100)}%,结构被你拆得很干净!`;
    api.onWin(stars, `第 ${level.id} 关「${level.name}」通关!${detail}`);
  }

  function finishLose(): void {
    if (finishSent) return;
    if (mode === "endless") {
      finishSent = true;
      endlessScore += tallyEndless(false);
      const round = endlessRound?.round ?? 1;
      const prevBest = endlessBest;
      endlessBest = save.recordEndlessBest(meta.id, endlessScore);
      const isNewBest = endlessScore > prevBest;
      const line = endlessLine(round, endlessScore, endlessBest, isNewBest);
      msgEl.textContent = line;
      api.onLose(line);
      return;
    }
    if (!level) return;
    finishSent = true;
    msgEl.textContent = "小鸟用完啦,换个思路再来一次!";
    api.onLose(`还剩 ${beansAlive()} 颗绿绿豆～先打最下面那根撑着的柱子,上面塌下来常常能一次带走一片!`);
  }

  function updateFlow(dt: number): void {
    if ((!level && !endlessRound) || finishSent) return;

    if (phase !== "won" && phase !== "lost" && beansAlive() === 0) {
      phase = "won";
      endT = 0;
      shake = Math.max(shake, reduceMotion ? 0.08 : 0.25);
      // 胜利小仪式:金色星屑撒场,排队的小鸟一起跳(见 drawQueue)
      spawnBurst(WORLD_W / 2, 90, ["#FFD86B", "#FFE9A8", "#FFC1D8"], reduceMotion ? 5 : 12, 180, "star");
    }

    if (phase === "won") {
      endT += dt;
      // 命中 → 变形倒塌 → 结算三段之间留出时间,不瞬变
      if (endT > 0.8) finishWin();
      return;
    }
    if (phase === "lost") {
      endT += dt;
      if (endT > 0.6) finishLose();
      return;
    }

    if (phase === "fly") {
      const allDone = allBirdsDone(world);
      if (!allDone) {
        nextBirdT = 0;
        loseWaitT = 0;
        return;
      }
      if (queue.length > 0) {
        nextBirdT += dt;
        if (nextBirdT > 0.55) {
          nextBirdT = 0;
          loadNextBird(true);
        }
      } else {
        // 小鸟用完但场上还在动:等一切静止再判负(至少缓冲 0.6s,最长 3s 超时)
        loseWaitT += dt;
        if ((loseWaitT > 0.6 && worldCalm(world)) || loseWaitT > 3) {
          phase = "lost";
          endT = 0;
          playThrottled("oops", 0);
        }
      }
    }
  }

  /* ---------------- 输入 ---------------- */

  function canvasPos(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WORLD_W,
      // 缓冲区可能延展了天空,先映射到缓冲坐标再减掉天空高度得到世界坐标
      y: ((e.clientY - rect.top) / rect.height) * bufH - skyPad
    };
  }

  /** 空中点按:给窗口内的小鸟放技能,并把口诀写到教练卡上 */
  function fireSkill(): void {
    const bird = worldTriggerSkill(world);
    if (!bird) return;
    // 技能触发瞬间的白色闪圈(弱动效不放)
    if (!reduceMotion) rings.push({ x: bird.x, y: bird.y, t: 0, dur: 0.12, max: 26 });
    msgEl.textContent =
      bird.kind === "split"
        ? "云云分裂!三朵小云一起冲!"
        : bird.kind === "slam"
          ? "墩墩下砸!咚——!"
          : bird.kind === "drill"
            ? "闪闪加速钻!嗖——!"
            : "卷卷回旋!掉头咚——!";
  }

  function onPointerDown(e: PointerEvent): void {
    if ((!level && !endlessRound) || finishSent) return;
    e.preventDefault();
    if (phase === "aim" && loadedBird && !loadedBird.flying && !aiming) {
      aiming = true;
      aimPointer = e.pointerId;
      // 捕获指针:手指拖出画布甚至拖出窗口都保持拉弓状态
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // 部分旧浏览器不支持,拖出画布时靠 window 监听兜底
      }
      const p = canvasPos(e);
      // 1.2 拖动锚点偏移:按下那一点就是锚点,小鸟不会跳到手指底下,
      // 手指与小鸟之间恒定隔着 FINGER_GAP,弹弓永远露在外面看得见。
      grabOff = grabOffset(p.x, p.y);
      setDrag(p.x, p.y);
    } else if (phase === "fly") {
      fireSkill();
    }
  }

  function setDrag(px: number, py: number): void {
    fingerX = px;
    fingerY = py;
    const d = dragFromPointer(px, py, grabOff);
    dragX = d.dx;
    dragY = d.dy;
    if (loadedBird) {
      loadedBird.x = SLING_X + dragX;
      loadedBird.y = SLING_Y + dragY;
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (!aiming || e.pointerId !== aimPointer) return;
    const p = canvasPos(e);
    setDrag(p.x, p.y);
  }

  function onPointerUp(e: PointerEvent): void {
    if (!aiming || e.pointerId !== aimPointer) return;
    aiming = false;
    aimPointer = -1;
    if (!loadedBird || finishSent) return;
    if (Math.hypot(dragX, dragY) < MIN_DRAG) {
      loadedBird.x = SLING_X;
      loadedBird.y = SLING_Y;
      return;
    }
    const v = launchVelocity(dragX, dragY);
    const bird = loadedBird;
    launchBird(world, bird, v.vx, v.vy);
    loadedBird = null;
    phase = "fly";
    launchT = 0;
    api.play("jump");
    api.play("pop");
    msgEl.textContent =
      bird.kind === "straight" ? "糯糯出发!笔直冲——" : "小鸟出发!飞行中点一下屏幕发动技能!";
    dragX = 0;
    dragY = 0;
    updateHud();
  }

  function onPointerCancel(e: PointerEvent): void {
    // 系统手势打断(来电、通知栏下拉等):小鸟放回弹弓,拉弓状态不丢
    if (!aiming || e.pointerId !== aimPointer) return;
    aiming = false;
    aimPointer = -1;
    dragX = 0;
    dragY = 0;
    if (loadedBird) {
      loadedBird.x = SLING_X;
      loadedBird.y = SLING_Y;
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === " " || e.key === "Enter") {
      if (phase === "fly" && !finishSent) {
        fireSkill();
        e.preventDefault();
      }
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("keydown", onKeyDown);

  retryBtn.addEventListener("click", () => {
    api.play("tap");
    stopSpeaking();
    if (mode === "endless") {
      startEndless();
    } else if (level) {
      openLevel(level.id);
    }
  });
  backBtn.addEventListener("click", () => {
    api.play("tap");
    showMap();
  });
  endlessBtn.addEventListener("click", () => {
    api.play("tap");
    stopSpeaking();
    startEndless();
  });

  /* ---------------- 渲染 ---------------- */

  const CH_STYLE = [
    { skyTop: "#D8F3FF", skyBot: "#F2FFE3", ground: "#B7E39B", groundEdge: "#96CE7A", hill: "#CBEDB0" },
    { skyTop: "#CFF0FF", skyBot: "#FFF6DC", ground: "#F6E0A8", groundEdge: "#E3C685", hill: "#BDE8F2" },
    { skyTop: "#DCE9FB", skyBot: "#FFFFFF", ground: "#EEF4FB", groundEdge: "#CFDFF0", hill: "#E4EEF9" },
    { skyTop: "#3B4879", skyBot: "#7D89C4", ground: "#8F97CE", groundEdge: "#737DB8", hill: "#5E6AA6" },
    { skyTop: "#57334A", skyBot: "#E08356", ground: "#8A5148", groundEdge: "#6E3E38", hill: "#B05548" },
    { skyTop: "#BFE3FF", skyBot: "#FFE9F4", ground: "#F0E9FF", groundEdge: "#D7C7F2", hill: "#E6F4FF" },
    // 1.1 新三章:风车高地 / 冰晶矿洞 / 熔岩工坊
    { skyTop: "#CDEFE3", skyBot: "#FDFBE3", ground: "#A8D9A0", groundEdge: "#84BE7E", hill: "#C4E8B8" },
    { skyTop: "#2E3A5C", skyBot: "#57699B", ground: "#6E7FB2", groundEdge: "#55628F", hill: "#48568A" },
    { skyTop: "#4A3244", skyBot: "#E0985E", ground: "#7A4F3E", groundEdge: "#5E3B30", hill: "#A4573F" }
  ];

  function drawBg(c: CanvasRenderingContext2D, chapter: number, midShift: number): void {
    const st = CH_STYLE[chapter];
    // 天空渐变一直铺到画布顶(竖屏时上方延展出的天空区)
    const grad = c.createLinearGradient(0, -skyPad, 0, WORLD_H);
    grad.addColorStop(0, st.skyTop);
    grad.addColorStop(1, st.skyBot);
    c.fillStyle = grad;
    c.fillRect(0, -skyPad, WORLD_W, skyPad + WORLD_H);

    // 延展天空里飘几朵慢云,画面不空
    if (skyPad > 40) {
      c.fillStyle = "rgba(255,255,255,.55)";
      for (let i = 0; i < 5; i++) {
        const drift = ((world.simT * (7 + i * 2) + i * 210) % (WORLD_W + 160)) - 80;
        const cy = -skyPad + 26 + ((i * 97) % Math.max(skyPad - 46, 1));
        c.beginPath();
        c.arc(drift, cy, 14, 0, Math.PI * 2);
        c.arc(drift + 17, cy - 6, 10, 0, Math.PI * 2);
        c.arc(drift + 33, cy, 12, 0, Math.PI * 2);
        c.fill();
      }
    }

    if (chapter === 0) {
      c.fillStyle = st.hill;
      c.beginPath();
      c.ellipse(120, GROUND_Y + 24, 180, 60, 0, Math.PI, 0);
      c.ellipse(420, GROUND_Y + 30, 220, 74, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = "#FFE9A8";
      c.beginPath();
      c.arc(490, 44, 24, 0, Math.PI * 2);
      c.fill();
    } else if (chapter === 1) {
      c.fillStyle = "#FFDE8A";
      c.beginPath();
      c.arc(478, 48, 26, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = st.hill;
      c.beginPath();
      c.ellipse(60, GROUND_Y - 4, 130, 26, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = "rgba(255,255,255,.7)";
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.ellipse(90 + i * 160, 60 + (i % 2) * 26, 30, 11, 0, 0, Math.PI * 2);
        c.fill();
      }
    } else if (chapter === 2) {
      c.fillStyle = st.hill;
      c.beginPath();
      c.ellipse(140, GROUND_Y + 20, 200, 66, 0, Math.PI, 0);
      c.ellipse(440, GROUND_Y + 26, 200, 80, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = "rgba(255,255,255,.9)";
      for (let i = 0; i < 22; i++) {
        const sx = ((i * 97) % WORLD_W) + Math.sin(world.simT * 0.7 + i) * 8;
        const sy = ((i * 53 + world.simT * 26) % (GROUND_Y + 20));
        c.beginPath();
        c.arc(sx, sy, i % 3 === 0 ? 2.4 : 1.6, 0, Math.PI * 2);
        c.fill();
      }
    } else if (chapter === 3) {
      c.fillStyle = "#FFF3B8";
      c.beginPath();
      c.arc(480, 52, 24, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = st.skyTop;
      c.beginPath();
      c.arc(470, 46, 20, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,255,240,.9)";
      for (let i = 0; i < 26; i++) {
        const tw = 0.5 + 0.5 * Math.sin(world.simT * 2 + i * 1.3);
        c.globalAlpha = 0.35 + tw * 0.6;
        c.beginPath();
        c.arc(((i * 83) % WORLD_W), (i * 37) % 190, i % 4 === 0 ? 2 : 1.3, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    } else if (chapter === 4) {
      // 火山峡谷:远处火山口 + 飘升的火星
      c.fillStyle = st.hill;
      c.beginPath();
      c.moveTo(360, GROUND_Y);
      c.lineTo(440, 90);
      c.lineTo(468, 90);
      c.lineTo(540, GROUND_Y);
      c.closePath();
      c.fill();
      c.fillStyle = "#FFB65C";
      c.beginPath();
      c.ellipse(454, 90, 20, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,150,70,.85)";
      for (let i = 0; i < 12; i++) {
        const t = (world.simT * 30 + i * 47) % 140;
        const ex = 454 + Math.sin(world.simT * 1.4 + i * 2.1) * (10 + i * 3);
        c.globalAlpha = 0.75 - (t / 140) * 0.7;
        c.beginPath();
        c.arc(ex, 86 - t, i % 3 === 0 ? 3 : 2, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    } else if (chapter === 5) {
      // 彩虹云端:大彩虹拱 + 飘飘白云
      const arc = ["#FF9E9E", "#FFCE8A", "#FFF3A8", "#B4E8A5", "#A5D4F5", "#CBB2F0"];
      c.lineWidth = 10;
      for (let i = 0; i < arc.length; i++) {
        c.strokeStyle = arc[i];
        c.globalAlpha = 0.55;
        c.beginPath();
        c.arc(WORLD_W / 2, GROUND_Y + 210, 330 - i * 11, Math.PI * 1.2, Math.PI * 1.8);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.fillStyle = "rgba(255,255,255,.9)";
      for (let i = 0; i < 4; i++) {
        const drift = ((world.simT * 9 + i * 150) % (WORLD_W + 120)) - 60;
        const cy = 46 + i * 58;
        c.beginPath();
        c.arc(drift, cy, 16, 0, Math.PI * 2);
        c.arc(drift + 19, cy - 7, 12, 0, Math.PI * 2);
        c.arc(drift + 37, cy, 14, 0, Math.PI * 2);
        c.fill();
      }
    } else if (chapter === 6) {
      // 风车高地:远山 + 一座慢慢转的大风车
      c.fillStyle = st.hill;
      c.beginPath();
      c.ellipse(140, GROUND_Y + 22, 190, 64, 0, Math.PI, 0);
      c.ellipse(430, GROUND_Y + 28, 210, 78, 0, Math.PI, 0);
      c.fill();
      const wx = 452;
      const wy = 118;
      c.fillStyle = "#E9DFC8";
      c.strokeStyle = "#C9B992";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(wx - 16, GROUND_Y);
      c.lineTo(wx - 7, wy);
      c.lineTo(wx + 7, wy);
      c.lineTo(wx + 16, GROUND_Y);
      c.closePath();
      c.fill();
      c.stroke();
      c.save();
      c.translate(wx, wy);
      c.rotate(world.simT * 0.7);
      c.fillStyle = "rgba(255,255,255,.92)";
      c.strokeStyle = "#B9CFE8";
      c.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        c.rotate(Math.PI / 2);
        c.beginPath();
        c.ellipse(0, -30, 8, 26, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      c.fillStyle = "#F2B4C6";
      c.beginPath();
      c.arc(0, 0, 5, 0, Math.PI * 2);
      c.fill();
      c.restore();
      // 空中飘着几缕被风吹动的草叶
      c.strokeStyle = "rgba(140,190,130,.7)";
      c.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) {
        const t = (world.simT * 60 + i * 71) % (WORLD_W + 80);
        const ly = 60 + ((i * 47) % 170);
        c.beginPath();
        c.moveTo(t - 40, ly);
        c.quadraticCurveTo(t - 28, ly - 5, t - 16, ly);
        c.stroke();
      }
    } else if (chapter === 7) {
      // 冰晶矿洞:洞顶垂下的钟乳石 + 一闪一闪的蓝水晶
      c.fillStyle = "rgba(40,52,88,.9)";
      for (let i = 0; i < 7; i++) {
        const sx = 40 + i * 78;
        const sh = 26 + ((i * 31) % 34);
        c.beginPath();
        c.moveTo(sx - 13, 0);
        c.lineTo(sx, sh);
        c.lineTo(sx + 13, 0);
        c.closePath();
        c.fill();
      }
      for (let i = 0; i < 10; i++) {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(world.simT * 1.6 + i * 1.1));
        const cx2 = ((i * 103 + 30) % WORLD_W);
        const cy2 = 70 + ((i * 61) % 160);
        c.globalAlpha = 0.35 + tw * 0.5;
        c.fillStyle = i % 2 === 0 ? "#9FD8F2" : "#C4B2F0";
        c.beginPath();
        c.moveTo(cx2, cy2 - 7);
        c.lineTo(cx2 + 5, cy2);
        c.lineTo(cx2, cy2 + 7);
        c.lineTo(cx2 - 5, cy2);
        c.closePath();
        c.fill();
      }
      c.globalAlpha = 1;
      c.fillStyle = st.hill;
      c.beginPath();
      c.ellipse(90, GROUND_Y + 16, 150, 46, 0, Math.PI, 0);
      c.fill();
    } else if (chapter === 8) {
      // 熔岩工坊:两只慢慢转的大齿轮 + 底部熔炉红光
      const gearAt = (gx: number, gy: number, gr: number, dir: number): void => {
        c.save();
        c.translate(gx, gy);
        c.rotate(world.simT * 0.5 * dir);
        c.fillStyle = "rgba(120,86,70,.55)";
        for (let i = 0; i < 8; i++) {
          c.rotate(Math.PI / 4);
          c.fillRect(-4, -gr - 7, 8, 9);
        }
        c.beginPath();
        c.arc(0, 0, gr, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(224,152,94,.5)";
        c.beginPath();
        c.arc(0, 0, gr * 0.4, 0, Math.PI * 2);
        c.fill();
        c.restore();
      };
      gearAt(468, 70, 26, 1);
      gearAt(508, 108, 17, -1);
      c.fillStyle = st.hill;
      c.beginPath();
      c.moveTo(60, GROUND_Y);
      c.lineTo(110, 150);
      c.lineTo(150, 150);
      c.lineTo(196, GROUND_Y);
      c.closePath();
      c.fill();
      c.fillStyle = "#FFB65C";
      c.beginPath();
      c.ellipse(130, 150, 18, 6, 0, 0, Math.PI * 2);
      c.fill();
      // 熔炉里飘起的火星
      c.fillStyle = "rgba(255,170,90,.85)";
      for (let i = 0; i < 10; i++) {
        const t = (world.simT * 34 + i * 53) % 150;
        const ex = 130 + Math.sin(world.simT * 1.2 + i * 1.9) * (8 + i * 2.5);
        c.globalAlpha = 0.7 - (t / 150) * 0.65;
        c.beginPath();
        c.arc(ex, 146 - t, i % 3 === 0 ? 2.8 : 2, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    }

    // 中景剪影层(1.3):树/雪杉雪人/云堡浮岛…压在远景与近景战场之间,
    // 镜头拉伸时轻微视差(midShift,弱动效恒 0),给画面补一层纵深
    drawMidground(c, chapter, GROUND_Y, WORLD_W, midShift);

    // 地面(向下延展的泥土区一起铺满)
    c.fillStyle = st.ground;
    c.fillRect(0, GROUND_Y, WORLD_W, WORLD_H + groundPad - GROUND_Y);
    c.fillStyle = st.groundEdge;
    c.fillRect(0, GROUND_Y, WORLD_W, 5);
    // 近景草丛带:三角草簇每 60px 一组(确定性摆放,天然静态)
    drawGrassStrip(c, chapter, GROUND_Y, WORLD_W);

    // 延展泥土里点缀小石子当装饰
    if (groundPad > 14) {
      c.fillStyle = st.groundEdge;
      c.globalAlpha = 0.5;
      for (let i = 0; i < 12; i++) {
        const px = (i * 89 + 40) % WORLD_W;
        const py = WORLD_H + 8 + ((i * 53) % Math.max(groundPad - 12, 1));
        c.beginPath();
        c.ellipse(px, py, i % 3 === 0 ? 5 : 3.4, i % 3 === 0 ? 3.4 : 2.4, (i % 5) * 0.5, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    }
  }

  function drawWinds(c: CanvasRenderingContext2D): void {
    for (const w of world.winds) {
      c.fillStyle = "rgba(180,225,255,0.20)";
      c.beginPath();
      c.roundRect(w.x, w.y, w.w, w.h, 14);
      c.fill();
      c.strokeStyle = "rgba(140,200,245,0.8)";
      c.lineWidth = 2;
      const ang = Math.atan2(w.fy, w.fx);
      const speed = 42;
      for (let i = 0; i < 7; i++) {
        const t = (world.simT * speed + i * 31) % 60;
        const bx = w.x + ((i * 67) % Math.max(w.w - 20, 10)) + 10;
        const by = w.y + ((i * 41) % Math.max(w.h - 20, 10)) + 10;
        const px = bx + Math.cos(ang) * t;
        const py = by + Math.sin(ang) * t;
        c.globalAlpha = 0.7 - (t / 60) * 0.6;
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(px - Math.cos(ang) * 13, py - Math.sin(ang) * 13);
        c.stroke();
      }
      c.globalAlpha = 1;
    }
  }

  function drawSlopes(c: CanvasRenderingContext2D, chapter: number): void {
    const st = CH_STYLE[chapter];
    for (const s of world.slopes) {
      c.fillStyle = st.ground;
      c.beginPath();
      if (s.dir === "up-right") {
        c.moveTo(s.x, s.y + s.h);
        c.lineTo(s.x + s.w, s.y);
        c.lineTo(s.x + s.w, s.y + s.h);
      } else {
        c.moveTo(s.x, s.y);
        c.lineTo(s.x + s.w, s.y + s.h);
        c.lineTo(s.x, s.y + s.h);
      }
      c.closePath();
      c.fill();
      c.strokeStyle = st.groundEdge;
      c.lineWidth = 4;
      c.beginPath();
      if (s.dir === "up-right") {
        c.moveTo(s.x, s.y + s.h);
        c.lineTo(s.x + s.w, s.y);
      } else {
        c.moveTo(s.x, s.y);
        c.lineTo(s.x + s.w, s.y + s.h);
      }
      c.stroke();
    }
  }

  function drawPortals(c: CanvasRenderingContext2D): void {
    for (let i = 0; i < world.portals.length; i++) {
      const p = world.portals[i];
      // 同一对门用同一组颜色,两口各偏一点色相好区分进出
      const colA = i % 2 === 0 ? "#8F7BE0" : "#5FBF8F";
      const colB = i % 2 === 0 ? "#5FC4DC" : "#E0A45F";
      for (const [mx, my, col] of [
        [p.ax, p.ay, colA],
        [p.bx, p.by, colB]
      ] as Array<[number, number, string]>) {
        const wob = Math.sin(world.simT * 3 + mx * 0.05) * 1.5;
        c.save();
        c.translate(mx, my);
        c.rotate(world.simT * 1.4);
        c.strokeStyle = col;
        c.globalAlpha = 0.9;
        c.lineWidth = 3;
        c.beginPath();
        c.ellipse(0, 0, p.r + wob, (p.r + wob) * 0.62, 0, 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 0.45;
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(0, 0, (p.r + wob) * 0.6, (p.r + wob) * 0.34, 0.6, 0, Math.PI * 2);
        c.stroke();
        c.restore();
        c.globalAlpha = 0.22;
        c.fillStyle = col;
        c.beginPath();
        c.arc(mx, my, p.r * 0.85, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;
        // 小星星在门口打转,提示这是能钻进去的洞
        const sa = world.simT * 2.2 + (mx + my) * 0.01;
        c.fillStyle = "#FFFFFF";
        c.beginPath();
        c.arc(mx + Math.cos(sa) * (p.r + 4), my + Math.sin(sa) * (p.r + 4) * 0.62, 1.8, 0, Math.PI * 2);
        c.fill();
      }
      // 两口之间画一条淡淡的虚线,小朋友一眼看懂它们是一对
      c.strokeStyle = "rgba(160,150,220,0.3)";
      c.lineWidth = 1.5;
      c.setLineDash([3, 7]);
      c.beginPath();
      c.moveTo(p.ax, p.ay);
      c.lineTo(p.bx, p.by);
      c.stroke();
      c.setLineDash([]);
    }
  }

  function drawPlatforms(c: CanvasRenderingContext2D): void {
    for (const p of world.platforms) {
      c.strokeStyle = "rgba(150,160,220,0.5)";
      c.lineWidth = 2;
      c.setLineDash([4, 5]);
      c.beginPath();
      c.moveTo(p.def.x - p.def.dx + p.def.w / 2, p.def.y - p.def.dy + p.def.h / 2);
      c.lineTo(p.def.x + p.def.dx + p.def.w / 2, p.def.y + p.def.dy + p.def.h / 2);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = "#C9BCF2";
      c.strokeStyle = "#A393DD";
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(p.x, p.y, p.def.w, p.def.h, 6);
      c.fill();
      c.stroke();
    }
  }

  function drawBlocks(c: CanvasRenderingContext2D): void {
    for (const bl of world.blocks) {
      if (bl.dead) continue;
      // 命中反馈第一段「变形」:刚挨过打的块会歪一下、抖一抖,再倒、再结算
      const stress = reduceMotion ? Math.min(bl.stress, 0.25) : bl.stress;
      const shaky = stress > 0.02;
      if (shaky) {
        c.save();
        c.translate(bl.x + bl.w / 2, bl.y + bl.h / 2);
        c.rotate(Math.sin(world.simT * 26 + bl.x) * 0.05 * stress);
        c.scale(1 + 0.05 * stress, 1 - 0.05 * stress);
        c.translate(-(bl.x + bl.w / 2), -(bl.y + bl.h / 2));
      }
      // 材质纹理与残血裂纹分级(>50% 完好 / ≤50% 一条折线 / ≤25% 三条放射)在 art.ts
      drawBlockArt(c, { kind: bl.kind, x: bl.x, y: bl.y, w: bl.w, h: bl.h, ratio: bl.hp / bl.maxHp });
      if (shaky) c.restore();
    }
  }

  function drawBoulders(c: CanvasRenderingContext2D): void {
    for (const bo of world.boulders) {
      const g = c.createRadialGradient(bo.x - bo.r * 0.35, bo.y - bo.r * 0.4, bo.r * 0.2, bo.x, bo.y, bo.r * 1.1);
      g.addColorStop(0, "#D2CCC3");
      g.addColorStop(1, "#A29B91");
      c.fillStyle = g;
      c.strokeStyle = "#948D84";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(bo.x, bo.y, bo.r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.strokeStyle = "rgba(120,112,102,0.6)";
      c.beginPath();
      c.moveTo(bo.x, bo.y);
      c.lineTo(bo.x + Math.cos(bo.rot) * bo.r * 0.7, bo.y + Math.sin(bo.rot) * bo.r * 0.7);
      c.stroke();
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.beginPath();
      c.ellipse(bo.x - bo.r * 0.32, bo.y - bo.r * 0.4, bo.r * 0.26, bo.r * 0.15, -0.5, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawBalloons(c: CanvasRenderingContext2D): void {
    for (const bal of world.balloons) {
      if (bal.popped) continue;
      if (!bal.bean.dead) {
        c.strokeStyle = "rgba(150,140,120,0.8)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(bal.x, bal.y + bal.r);
        c.lineTo(bal.bean.x, bal.bean.y - bal.bean.r);
        c.stroke();
      }
      const g = c.createRadialGradient(bal.x - bal.r * 0.3, bal.y - bal.r * 0.4, bal.r * 0.2, bal.x, bal.y, bal.r * 1.25);
      g.addColorStop(0, "#FFDCEA");
      g.addColorStop(1, "#FFAECB");
      c.fillStyle = g;
      c.strokeStyle = "#EE9BBB";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(bal.x, bal.y, bal.r, bal.r * 1.15, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      // 气球结
      c.fillStyle = "#EE9BBB";
      c.beginPath();
      c.moveTo(bal.x - 3, bal.y + bal.r * 1.15 + 3);
      c.lineTo(bal.x + 3, bal.y + bal.r * 1.15 + 3);
      c.lineTo(bal.x, bal.y + bal.r * 1.15 - 2);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.75)";
      c.beginPath();
      c.ellipse(bal.x - 4, bal.y - 5, 3.4, 5, -0.5, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawBeans(c: CanvasRenderingContext2D): void {
    // 失败结算的 0.6s:豆豆们开心跳一小段舞(幸灾乐祸要可爱不要嘲讽;弱动效静止)
    const dance = phase === "lost" && !reduceMotion;
    for (let i = 0; i < world.beans.length; i++) {
      const bean = world.beans[i];
      if (bean.dead) continue;
      const wob = reduceMotion ? 0 : Math.sin(world.simT * 4 + bean.x * 0.13) * 1.2;
      // 待机偶发眨眼:全员共用周期、相位按序号错开,每个瞬间最多一两只在眨
      const blink = reduceMotion ? 0 : (world.simT + i * 1.31) % 4.6 > 4.45 ? 1 : 0;
      drawBeanArt(c, beanVariant(i), {
        x: bean.x,
        y: bean.y - (dance ? Math.abs(Math.sin(world.simT * 8 + i)) * 3 : 0),
        r: bean.r,
        wob,
        blink,
        tilt: dance ? Math.sin(world.simT * 8 + i) * 0.2 : 0
      });
    }
    // 被击中的 0.2s「惊讶脸」残影,随后交给星屑与叶子(弱动效为原地淡出)
    for (const gst of beanGhosts) {
      const k = clamp(gst.t / 0.22, 0, 1);
      c.globalAlpha = 1 - k;
      drawBeanArt(c, gst.variant, {
        x: gst.x,
        y: gst.y - (reduceMotion ? 0 : k * 14),
        r: 10,
        surprise: true
      });
      c.globalAlpha = 1;
    }
  }

  /** 待机眨眼相位:约 3.4s 闭一下,seed 错开各自节奏(弱动效恒睁眼) */
  function blinkPhase(seed: number): number {
    if (reduceMotion) return 0;
    return (world.simT + seed) % 3.4 > 3.22 ? 1 : 0;
  }

  function drawBird(c: CanvasRenderingContext2D, bird: RtBird): void {
    const info = BIRD_INFO[bird.kind];
    const ang = bird.flying ? Math.atan2(bird.vy, bird.vx) * 0.25 : 0;
    const flap = bird.flying
      ? Math.sin(bird.age * 18) * 0.35
      : reduceMotion
        ? 0
        : Math.sin(world.simT * 3 + bird.x) * 0.08;
    // 技能触发窗口:窗口开着就套一圈光环,窗口越到后面圈越淡(告诉孩子「现在可以点」)
    if (canTriggerSkill(bird)) {
      const left = clamp(1 - bird.age / SKILL_WINDOW_END, 0, 1);
      c.save();
      c.globalAlpha = 0.25 + left * 0.45;
      c.strokeStyle = info.dark;
      c.lineWidth = 2;
      c.setLineDash([4, 4]);
      c.beginPath();
      c.arc(bird.x, bird.y, bird.r + 5 + Math.sin(world.simT * 8) * 1.2, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.restore();
    }
    // 表情状态:拉弓鼓腮蓄力 / 飞行瞪眼 / 落地捂头眨眼 / 待机
    const speed = Math.hypot(bird.vx, bird.vy);
    const mood: BirdMood = bird.flying
      ? bird.restT > 0.05
        ? "rest"
        : "fly"
      : aiming && bird === loadedBird && Math.hypot(dragX, dragY) >= MIN_DRAG
        ? "charge"
        : "idle";
    drawBirdArt(c, {
      kind: bird.kind,
      x: bird.x,
      y: bird.y,
      r: bird.r,
      angle: ang,
      flap,
      mood,
      blink:
        mood === "rest"
          ? reduceMotion
            ? 0
            : (world.simT * 2) % 1 > 0.5
              ? 1
              : 0
          : blinkPhase(bird.x * 0.13),
      // 速度线:飞得够快才拖白线(弱动效不拖)
      dash: bird.flying && !reduceMotion ? clamp((speed - 300) / 260, 0, 1) : 0
    });
  }

  function drawSlingshot(c: CanvasRenderingContext2D): void {
    // 木叉/底座草石点缀/双线皮筋(暗边 + 亮边)在 art.ts;张力只是视觉,发射力度仍由 aim.ts 决定
    const tension = bandTension(Math.hypot(dragX, dragY));
    const loaded = loadedBird && !loadedBird.flying ? loadedBird : null;
    drawSlingshotArt(c, {
      x: SLING_X,
      y: SLING_Y,
      groundY: GROUND_Y,
      birdX: loaded ? loaded.x : null,
      birdY: loaded ? loaded.y : null,
      tension
    });
  }

  /**
   * 弹道预测:8–12 个衰减小点,前 60% 精确、后 40% 淡出。
   * 故意不画完整落点圈——最后那一段留给孩子自己估。
   */
  function drawTrajectory(c: CanvasRenderingContext2D): void {
    if (!aiming || !loadedBird) return;
    const len = Math.hypot(dragX, dragY);
    if (len < MIN_DRAG) return;
    const v = launchVelocity(dragX, dragY);
    const dots = previewDots(
      loadedBird.x,
      loadedBird.y,
      v.vx,
      v.vy,
      loadedBird.gfactor,
      world.winds,
      previewDotCount(len)
    );
    for (const dot of dots) {
      // 1.3:小白点换成小星点(四角星),精确段仍带淡蓝描边;dots 的数学一字未动
      c.globalAlpha = dot.alpha;
      drawSparklePoint(c, dot.x, dot.y, dot.radius, dot.precise);
    }
    c.globalAlpha = 1;
    // 手指与小鸟之间的牵引线:让孩子看懂「我按的地方」和「小鸟在哪」是分开的
    c.globalAlpha = 0.28;
    c.strokeStyle = "#4C7DB3";
    c.lineWidth = 1.5;
    c.setLineDash([4, 5]);
    c.beginPath();
    c.moveTo(loadedBird.x, loadedBird.y);
    c.lineTo(fingerX, fingerY);
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 1;
  }

  function drawQueue(c: CanvasRenderingContext2D): void {
    // 排队等候的小鸟站在弹弓后面;第一只原地小跳,胜利结算时全员跳(弱动效静止)
    // 1.3 r3 · R2-TOP10 结算仪式(绘制层子集):省下的小鸟按 0.25s 间隔逐只腾一个
    // 小弧、弧上绕三粒金色星屑——纯 endT 驱动的演出,queue/物理/计分零改动;
    // 全部动作在 0.69s 内落地(finishWin 后画面冻结,不留半空定格帧);弱动效维持静止。
    let qx = SLING_X - 34;
    for (let qi = 0; qi < queue.length; qi++) {
      const kind = queue[qi];
      const r = BIRD_INFO[kind].r * 0.82;
      const leap = phase === "won" && !reduceMotion ? winLeapPhase(endT, qi) : 0;
      const lift = Math.sin(Math.PI * leap) * WIN_LEAP_H;
      const hop =
        !reduceMotion && (qi === 0 || phase === "won")
          ? Math.abs(Math.sin(world.simT * 5 + qi * 1.7)) * 3.5
          : 0;
      const by = GROUND_Y - r - hop - lift;
      drawBirdArt(c, {
        kind,
        x: qx,
        y: by,
        r,
        flap: reduceMotion ? 0 : Math.sin(world.simT * (leap > 0 ? 14 : 3) + qx) * (leap > 0 ? 0.4 : 0.08),
        mood: leap > 0 ? "fly" : "idle",
        blink: blinkPhase(qx * 0.13)
      });
      if (leap > 0) {
        // 弧顶三粒金星屑绕小鸟转小半圈,随腾跃进度淡入淡出
        for (let s = 0; s < 3; s++) {
          const sa = leap * Math.PI * 1.6 + (s * Math.PI * 2) / 3;
          drawWinSparkle(
            c,
            qx + Math.cos(sa) * (r + 7),
            by + Math.sin(sa) * (r + 7) * 0.7,
            2.4,
            Math.sin(Math.PI * leap)
          );
        }
      }
      qx -= 24;
      if (qx < 14) break;
    }
  }

  function drawParticles(c: CanvasRenderingContext2D): void {
    // 材质碎片:木长条 / 石四边形 / 冰三角 / 岩壳圆石 / 晶核菱片 / TNT 火花 / 羽毛 / 叶子 / 星屑
    for (const p of particles) {
      c.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      c.save();
      c.translate(p.x, p.y);
      if (p.rot !== 0) c.rotate(p.rot);
      drawShard(c, p.shape, p.size, p.color);
      c.restore();
    }
    c.globalAlpha = 1;
    // TNT 冲击波环 / 技能白闪圈
    for (const ring of rings) drawShockRing(c, ring.x, ring.y, ring.t / ring.dur, ring.max);
  }

  function drawBanner(c: CanvasRenderingContext2D): void {
    if (introT <= 0) return;
    // 横幅标题不再贴章节 emoji——两端的 drawBannerBadge 已是全绘制的章节角标
    const title = level
      ? `第${level.id}关 ${level.name}`
      : endlessRound
        ? `${endlessRound.name} · 共 ${ENDLESS_BIRDS} 只小鸟`
        : "";
    if (!title) return;
    const a = clamp(introT > 1.6 ? (2 - introT) * 2.5 : introT / 0.5, 0, 1);
    // 钉在画布顶部(天空延展时不跟着世界坐标掉到屏幕中间)
    const by = 24 - skyPad;
    c.globalAlpha = a;
    c.fillStyle = "rgba(255,255,255,0.92)";
    c.beginPath();
    c.roundRect(WORLD_W / 2 - 120, by, 240, 46, 16);
    c.fill();
    c.fillStyle = "#3E6D9E";
    c.font = "bold 17px sans-serif";
    c.textAlign = "center";
    c.fillText(title, WORLD_W / 2, by + 29);
    c.textAlign = "left";
    // 圆角条两端的章节角标(小花 / 雪花 / 星星…全部绘制资产)
    drawBannerBadge(c, WORLD_W / 2 - 104, by + 23, 7, sceneChapter());
    drawBannerBadge(c, WORLD_W / 2 + 104, by + 23, 7, sceneChapter());
    c.globalAlpha = 1;
  }

  function draw(): void {
    if (!ctx || (!level && !endlessRound)) return;
    const chapter = sceneChapter();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14);
    }
    // 松手瞬间轻轻把镜头拉一下,给弹射一点力量感(reduced-motion 下自动归零)
    const stretch = releaseStretch(launchT, 1, reduceMotion ? 0 : 1);
    if (stretch !== 1) {
      ctx.translate(SLING_X, SLING_Y + skyPad);
      ctx.scale(stretch, stretch);
      ctx.translate(-SLING_X, -(SLING_Y + skyPad));
    }
    // 世界坐标整体下移天空高度:上方是延展天空,下方是延展泥土
    ctx.translate(0, skyPad);
    // 中景剪影随镜头拉伸微移(视差;reduceMotion 时 stretch 恒 1 → 位移恒 0)
    drawBg(ctx, chapter, (stretch - 1) * 60);
    drawWinds(ctx);
    drawSlopes(ctx, chapter);
    drawPortals(ctx);
    drawPlatforms(ctx);
    drawBlocks(ctx);
    drawBoulders(ctx);
    drawBalloons(ctx);
    drawBeans(ctx);
    drawQueue(ctx);
    drawSlingshot(ctx);
    for (const bird of world.birds) {
      if (!bird.dead) drawBird(ctx, bird);
    }
    if (loadedBird) drawBird(ctx, loadedBird);
    drawTrajectory(ctx);
    drawParticles(ctx);
    drawBanner(ctx);
    ctx.restore();
  }

  /* ---------------- 主循环 ---------------- */

  function tick(now: number): void {
    if (destroyed) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    if (level || endlessRound) {
      if (!finishSent) {
        // 固定步长:advance 内部按 1/180 秒补步,60fps 与 30fps 落点一致
        advance(world, dt);
        updateFlow(dt);
      }
      shake = Math.max(0, shake - dt * 1.6);
      introT = Math.max(0, introT - dt);
      launchT += dt;
      for (const p of particles) {
        p.life -= dt;
        // 羽毛与叶子飘着落(重力打二折),其余碎片正常坠
        p.vy += GRAVITY * (p.shape === "feather" || p.shape === "leaf" ? 0.12 : 0.5) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      particles = particles.filter((p) => p.life > 0);
      for (const ring of rings) ring.t += dt;
      rings = rings.filter((r) => r.t < r.dur);
      for (const gst of beanGhosts) gst.t += dt;
      beanGhosts = beanGhosts.filter((g) => g.t < 0.22);
      // 飞行演出:速度够快的小鸟每 0.15s 脱落一片小羽毛(弱动效不掉)
      if (!reduceMotion) {
        featherT += dt;
        if (featherT >= 0.15) {
          featherT = 0;
          const flyer = world.birds.find((b) => !b.dead && b.flying && Math.hypot(b.vx, b.vy) > 240);
          if (flyer && particles.length < 240) {
            particles.push({
              x: flyer.x - flyer.r * 0.6,
              y: flyer.y,
              vx: -20 - Math.random() * 24,
              vy: 8 + Math.random() * 20,
              life: 0.7,
              maxLife: 0.9,
              size: 3,
              color: BIRD_INFO[flyer.kind].color,
              shape: "feather",
              rot: Math.random() * Math.PI,
              vr: 3
            });
          }
        }
      }
      draw();
    }
    raf = requestAnimationFrame(tick);
  }

  /* ---------------- 启动 ---------------- */

  /** 平台「直达第 N 关」:壳层传 initialLevel,或地址栏 ?level=N */
  function levelFromQuery(search: string | null): number | null {
    if (!search) return null;
    const raw = new URLSearchParams(search).get("level");
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
  }

  const jumpTo =
    (api as { initialLevel?: number }).initialLevel ??
    levelFromQuery(typeof location === "object" ? location.search : null);
  const resume = progress.resume;
  if (jumpTo !== null && jumpTo !== undefined && openCampaignLevel(jumpTo)) {
    // 直达关号优先(家长门/root 门放行的直通车),不受解锁进度限制
  } else if (resume !== null && LEVELS.some((l) => l.id === resume) && isUnlocked(resume)) {
    openLevel(resume);
  } else {
    showMap();
  }

  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(nextTowerTimer);
      stopSpeaking();
      unwatchSpeech();
      resizeObserver?.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", measureCanvas);
      wrap.remove();
    }
  };
}
