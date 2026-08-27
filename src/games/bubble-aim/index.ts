import { meta } from "./meta";
export { meta };

// 泡泡瞄准手 —— 瞄准发射三消玩法 + 关卡战役：
// 选关地图、进度存档、石泡/彩虹泡/黑洞/云挡板/下落新行五种机关。
// 1.1 追加：下压顶板（每 N 发压下一整层石板）、反弹死角、限弹三章。
// 瞄准虚线和真实飞行用同一个 simulateShot，保证指哪打哪。
import {
  type Grid,
  type Obstacles,
  type ShotResult,
  DEADLINE_ROW,
  H,
  HOLE_R,
  R,
  RAINBOW,
  ROW_H,
  STONE,
  STONE_CRACKED,
  TOP,
  W,
  cellCenter,
  colorsInGrid,
  countBubbles,
  crossedDeadline,
  damageStone,
  descend,
  failedSpeechLine,
  isStone,
  nearDeadline,
  neighbors,
  parseLayout,
  pressCeiling,
  releaseLoneRainbows,
  rowLength,
  settleShot,
  simulateShot,
  starsForShotsLeft,
  wonSpeechLine,
} from "./logic";
import {
  LEVELS,
  MECH_INFO,
  THEMES,
  THEME_SIZES,
  budgetNote,
  levelMechanisms,
  parseStars,
  themeOfLevel,
  themeStart,
} from "./levels";
import { speak, stopSpeaking } from "../speech";
import { save } from "../../engine/save";
import {
  BOMB,
  COARSE_STEP_DEG,
  ENDLESS_PUSH_EVERY,
  SHOOTER_X,
  SHOOTER_Y,
  aimFromDrag,
  angleStepDeg,
  chainFontSize,
  chainLabel,
  chainScore,
  detonate,
  endlessLine,
  endlessPalette,
  endlessRow,
  endlessShouldPush,
  endlessStartRows,
  endlessTotal,
  fallGravity,
  fallenOut,
  fixDeadAmmo,
  isBomb,
  makeFaller,
  pickAmmo,
  previewPath,
  reload,
  stepFaller,
  swapLoader,
  type Faller,
  type Loader,
} from "./aim12";
import {
  BA_COLORS,
  BA_TIMINGS,
  aimDotRadius,
  aimDots,
  barrelAngle,
  bounceOffset,
  bounceStars,
  floatPopScale,
  fuseSparkPhase,
  isSquashy,
  paintBarrel,
  paintBombCat,
  paintBounceStar,
  paintBubble,
  paintLightBlobs,
  paintLoadSlot,
  paintRainbowOrb,
  paintShooterBase,
  paintShooterShadow,
  paintSqueezeDot,
  paintStarBadge,
  paintStoneRock,
  paintVineLampBand,
  rainbowSpinAngle,
  stoneCracked,
  swapPositions,
  swapProgress,
  trailFrames,
  vineShadowAlpha,
} from "./visual";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

const FLY_SPEED = 820;
const SAVE_KEY = "yiduo.bubble-aim.campaign.v2";
/** 装填槽(下一发预览)的位置:沿用 1.2 原坐标,炮台伸最长也遮不到 */
const NEXT_X = W - 46;
const NEXT_Y = SHOOTER_Y + 2;
/**
 * 无尽墙用的调色板:五色够热闹,又不至于凑不齐三连。
 * 实际每一行用几种由 `endlessPalette(rowsPushed, …)` 决定 —— 开局 3 色,压下来再逐步补满。
 */
const ENDLESS_COLORS = ["R", "Y", "G", "B", "P"];

const COLOR_FILL: Record<string, [string, string]> = {
  R: ["#FFA7BD", "#F26D93"],
  Y: ["#FFE38A", "#F0BE3E"],
  B: ["#A6D9FA", "#5BA7E0"],
  G: ["#BCE8A5", "#7CBE5F"],
  P: ["#DCC2FA", "#A87FDE"],
  [STONE]: ["#C9CBD4", "#8B8FA0"],
  [STONE_CRACKED]: ["#C9CBD4", "#7C8093"],
  [RAINBOW]: ["#FFFFFF", "#C9A7F5"],
};

interface Progress {
  /** 每关最佳星数 0-3（0=未通过） */
  stars: number[];
}

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as { stars?: unknown };
      if (Array.isArray(data.stars)) return { stars: parseStars(data.stars) };
    }
  } catch {
    // 读不到就当新档
  }
  return { stars: LEVELS.map(() => 0) };
}

function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  } catch {
    // 存不了也不影响本次游玩
  }
}

interface PopAnim {
  x: number;
  y: number;
  color: string;
  t: number;
}

interface CrackFx {
  x: number;
  y: number;
  t: number;
}

export function mount(api: GameApi): { destroy: () => void; fxCount: () => number } {
  let destroyed = false;
  let raf = 0;
  let lastTime = 0;
  let animTime = 0;

  const progress = loadProgress();
  let allDoneReported = false;

  let screen: "map" | "play" = "map";
  let levelIndex = 0;
  let phase: "play" | "won" | "failed" = "play";
  let phaseTime = 0;
  let bannerTime = 0;
  let failReason = "";
  let wonStars: 1 | 2 | 3 = 1;

  let grid: Grid = parseLayout(LEVELS[0].layout);
  let obstacles: Obstacles = {};
  let dropQueue: string[] = [];
  let dropEvery = 0;
  let pressEvery = 0;
  let pressLeft = 0;
  let shotsTotal = LEVELS[0].shots;
  let shotsLeft = shotsTotal;
  let shotsFired = 0;
  /** 发射器:手里这颗 + 下一颗,可以随时对调 */
  let loader: Loader = { current: "R", next: "B" };
  /** 无尽墙:一直打,每 5 发压一行,顶到底线为止 */
  let endless = false;
  let endlessPoints = 0;
  let rowsPushed = 0;
  /** 连锁:连着几发都消掉了东西 */
  let chain = 0;
  let bestEndless = save.getGameProgress(meta.id).endlessBest;
  /** 掉落连锁的飘字 */
  let floatText = "";
  let floatSize = 14;
  let floatTime = 0;
  /** 换弹旋转过场剩余毫秒(纯视觉;逻辑交换在按下那一刻已完成) */
  let swapFx = 0;
  const softMotion = (() => {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    return typeof mm === "function" ? !!mm("(prefers-reduced-motion: reduce)").matches : false;
  })();

  let aiming = false;
  let aimDx = 0;
  let aimDy = -1;
  /** 当前瞄准角度(度),画面上给个读数 */
  let aimDeg = 90;
  /** 拖得远了就进微调档,读数显示一位小数 */
  let fineAim = false;
  let flight: {
    result: ShotResult;
    seg: number;
    segPos: number;
    color: string;
  } | null = null;

  const pops: PopAnim[] = [];
  /** 失联的泡泡真的带着重力往下掉,不是原地消失 */
  const falls: Faller[] = [];
  /** 掉落串的拖尾残影(3 帧渐隐;reduced 不生成) */
  const trails: Array<{ x: number; y: number; color: string; life: number }> = [];
  const cracks: CrackFx[] = [];
  /** 掉落用的序号,同一批散得不一样 */
  let fallSeed = 0;

  const wrap = document.createElement("div");
  wrap.className = "ba-wrap";
  wrap.innerHTML = `
    <style>
      .ba-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E8F4FF, #FFEFF7); border-radius: 20px; padding: 12px; max-width: 400px; margin: 0 auto; user-select: none; touch-action: none; }
      .ba-top { display: flex; justify-content: space-between; align-items: center; gap: 4px; margin-bottom: 8px; }
      .ba-badge { background: linear-gradient(180deg, #ffffff, #F4F9FF); border: 1px solid rgba(90,140,200,.16); border-radius: 12px; padding: 5px 7px; font-weight: 700; color: #3E7CB8; box-shadow: 0 2px 5px rgba(93,84,110,.16); font-size: 14px; white-space: nowrap; }
      .ba-level { flex: 0 1 auto; min-width: 40px; overflow: hidden; text-overflow: ellipsis; }
      .ba-btn { border: none; border-radius: 12px; padding: 5px 9px; font-size: 14px; font-weight: 700; background: #CDE6FF; color: #2A6099; cursor: pointer; box-shadow: 0 3px 0 #A9CCEE; }
      .ba-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #A9CCEE; }
      .ba-canvas { width: 100%; border-radius: 16px; display: block; touch-action: none; cursor: crosshair; }
      .ba-msg { text-align: center; min-height: 20px; color: #4E8AC2; font-weight: 700; margin-top: 8px; font-size: 13px; }
      .ba-map { background: rgba(255,255,255,0.7); border-radius: 16px; padding: 12px; max-height: 520px; overflow-y: auto; }
      .ba-map-title { text-align: center; font-weight: 800; color: #2A6099; font-size: 17px; margin-bottom: 4px; }
      .ba-map-sub { text-align: center; color: #5E86B0; font-size: 12px; margin-bottom: 10px; }
      .ba-theme { border-radius: 14px; padding: 10px; margin-bottom: 10px; }
      .ba-th-head { font-weight: 800; font-size: 14px; margin-bottom: 2px; }
      .ba-th-blurb { font-size: 11px; opacity: 0.85; margin-bottom: 8px; }
      .ba-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .ba-lv { border: none; border-radius: 14px; padding: 8px 2px 6px; background: #fff; box-shadow: 0 3px 0 #C7DEF2; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .ba-lv:active { transform: translateY(2px); box-shadow: 0 1px 0 #C7DEF2; }
      .ba-lv .num { font-weight: 800; font-size: 15px; color: #2A6099; }
      .ba-lv .stars { font-size: 10px; letter-spacing: -1px; }
      .ba-lv .mech { font-size: 10px; min-height: 13px; }
      .ba-lv.locked { background: #E3EAF2; box-shadow: 0 3px 0 #CBD6E2; cursor: not-allowed; }
      .ba-lv.locked .num { color: #9AA9BC; }
      .bba-modes { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 10px; }
      .bba-mode { border: none; border-radius: 14px; padding: 8px 12px; font-size: 13px; font-weight: 800; background: #FFE7B8; color: #8A5A12; cursor: pointer; box-shadow: 0 3px 0 #E7C489; }
      .bba-mode:active { transform: translateY(2px); box-shadow: 0 1px 0 #E7C489; }
      .bba-swap { min-width: 44px; min-height: 34px; background: #FFDCEB; color: #A8467A; box-shadow: 0 3px 0 #EEB6CF; }
      .bba-swap:active { box-shadow: 0 1px 0 #EEB6CF; }
    </style>
    <div class="ba-top">
      <button class="ba-btn ba-back" type="button" title="回地图" aria-label="回地图">🗺️</button>
      <span class="ba-badge ba-level">第 1 关</span>
      <span class="ba-badge ba-count">🫧 0</span>
      <span class="ba-badge ba-shots">🎯 0</span>
      <button class="ba-btn bba-swap" type="button" title="换弹（Tab）" aria-label="换弹">🔀</button>
      <button class="ba-btn ba-retry" type="button">🔄</button>
    </div>
    <div class="ba-map">
      <div class="ba-map-title">🫧 泡泡瞄准手 · 188 关主题地图</div>
      <div class="ba-map-sub"></div>
      <div class="bba-modes">
        <button class="bba-mode bba-endless" type="button">♾️ 无尽墙</button>
      </div>
      <div class="ba-themes"></div>
    </div>
    <canvas class="ba-canvas" width="${W}" height="${H}"></canvas>
    <div class="ba-msg"></div>
  `;
  api.root.appendChild(wrap);

  const canvas = wrap.querySelector(".ba-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const topBar = wrap.querySelector(".ba-top") as HTMLElement;
  const mapEl = wrap.querySelector(".ba-map") as HTMLElement;
  const mapSubEl = wrap.querySelector(".ba-map-sub") as HTMLElement;
  const themesEl = wrap.querySelector(".ba-themes") as HTMLElement;
  const levelEl = wrap.querySelector(".ba-level") as HTMLElement;
  const countEl = wrap.querySelector(".ba-count") as HTMLElement;
  const shotsEl = wrap.querySelector(".ba-shots") as HTMLElement;
  const msgEl = wrap.querySelector(".ba-msg") as HTMLElement;
  const retryBtn = wrap.querySelector(".ba-retry") as HTMLButtonElement;
  const backBtn = wrap.querySelector(".ba-back") as HTMLButtonElement;
  const swapBtn = wrap.querySelector(".bba-swap") as HTMLButtonElement;
  const endlessBtn = wrap.querySelector(".bba-endless") as HTMLButtonElement;

  function unlocked(i: number): boolean {
    return i === 0 || progress.stars[i - 1] > 0;
  }

  function allCleared(): boolean {
    return progress.stars.every((s) => s > 0);
  }

  function totalStars(): number {
    return progress.stars.reduce((a, b) => a + b, 0);
  }

  // ---------- 地图 ----------

  function showMap(): void {
    screen = "map";
    stopSpeaking();
    flight = null;
    aiming = false;
    endless = false;
    topBar.style.display = "none";
    canvas.style.display = "none";
    mapEl.style.display = "";
    mapSubEl.textContent = `⭐ ${totalStars()}/${LEVELS.length * 3} · 通关 ${progress.stars.filter((s) => s > 0).length}/${LEVELS.length}`;
    endlessBtn.textContent = bestEndless > 0 ? `♾️ 无尽墙 · 最好 ${bestEndless} 分` : "♾️ 无尽墙";
    themesEl.innerHTML = "";
    THEMES.forEach((th, t) => {
      const start = themeStart(t);
      const size = THEME_SIZES[t];
      const cleared = progress.stars.slice(start, start + size).filter((s) => s > 0).length;
      const box = document.createElement("div");
      box.className = "ba-theme";
      box.style.background = th.tint;
      const head = document.createElement("div");
      head.className = "ba-th-head";
      head.style.color = th.ink;
      head.textContent = `${th.icon} ${th.name} · ${cleared}/${size}`;
      const blurb = document.createElement("div");
      blurb.className = "ba-th-blurb";
      blurb.style.color = th.ink;
      blurb.textContent = th.blurb;
      const grid = document.createElement("div");
      grid.className = "ba-grid";
      for (let k = 0; k < size; k++) {
        const i = start + k;
        const def = LEVELS[i];
        const btn = document.createElement("button");
        btn.type = "button";
        const open = unlocked(i);
        btn.className = open ? "ba-lv" : "ba-lv locked";
        const s = progress.stars[i];
        const icons = levelMechanisms(def).map((m) => MECH_INFO[m].icon).join("");
        btn.innerHTML = `
          <span class="num">${open ? i + 1 : "🔒"}</span>
          <span class="stars">${s > 0 ? "⭐".repeat(s) + "☆".repeat(3 - s) : open ? "☆☆☆" : ""}</span>
          <span class="mech">${icons}</span>
        `;
        btn.title = def.name;
        if (open) {
          btn.addEventListener("click", () => {
            api.play("tap");
            startLevel(i);
          });
        }
        grid.appendChild(btn);
      }
      box.append(head, blurb, grid);
      themesEl.appendChild(box);
    });
    msgEl.textContent = allCleared()
      ? "全部通关！还可以回去刷三星哦！"
      : "点亮的关卡都能玩，一路打到星尘试炼！";
  }

  // ---------- 关卡 ----------

  function updateHud(): void {
    if (endless) {
      levelEl.textContent = "♾️ 无尽墙";
      countEl.textContent = `🫧 ${countBubbles(grid)}`;
      shotsEl.textContent = `✨ ${endlessTotal(endlessPoints, rowsPushed)} · ⬇️${rowsPushed}`;
      return;
    }
    const def = LEVELS[levelIndex];
    levelEl.textContent = `${levelIndex + 1}. ${def.name}`;
    countEl.textContent = `🫧 ${countBubbles(grid)}`;
    let shotsText = `🎯 ${shotsLeft}`;
    if (dropQueue.length > 0 && dropEvery > 0) {
      const untilDrop = dropEvery - (shotsFired % dropEvery);
      shotsText += ` ⬇️${untilDrop}`;
    }
    if (pressLeft > 0 && pressEvery > 0) {
      shotsText += ` 🧊${pressEvery - (shotsFired % pressEvery)}`;
    }
    shotsEl.textContent = shotsText;
  }

  /** 开局上膛:颜色只从墙上真有的里挑,一进关就不会攥着死球 */
  function freshLoader(): Loader {
    const pool = colorsInGrid(grid);
    return { current: pickAmmo(pool, Math.random), next: pickAmmo(pool, Math.random) };
  }

  /** 后段章节与无尽墙才发特殊弹,前面几章保持 1.1 的手感 */
  function specialsFor(): { bomb: number; rainbow: number } {
    if (endless) return { bomb: 0.07, rainbow: 0.06 };
    if (levelIndex >= 99) return { bomb: 0.05, rainbow: 0.04 };
    return { bomb: 0, rainbow: 0 };
  }

  /** 手里的两颗都得配得上墙上还有的颜色,不然就是死球 */
  function refreshQueue(): void {
    if (colorsInGrid(grid).length === 0) return;
    loader = fixDeadAmmo(loader, grid, Math.random);
  }

  function startLevel(index: number): void {
    screen = "play";
    topBar.style.display = "";
    canvas.style.display = "";
    mapEl.style.display = "none";
    levelIndex = index;
    const def = LEVELS[index];
    grid = parseLayout(def.layout);
    obstacles = { clouds: def.clouds, holes: def.holes };
    dropQueue = [...(def.dropRows ?? [])];
    dropEvery = def.dropEvery ?? 0;
    pressEvery = def.pressEvery ?? 0;
    pressLeft = pressEvery > 0 ? (def.pressMax ?? 0) : 0;
    shotsTotal = def.shots;
    shotsLeft = def.shots;
    shotsFired = 0;
    phase = "play";
    phaseTime = 0;
    bannerTime = 1.6;
    flight = null;
    aiming = false;
    pops.length = 0;
    falls.length = 0;
    cracks.length = 0;
    endless = false;
    chain = 0;
    floatTime = 0;
    swapFx = 0;
    loader = freshLoader();
    msgEl.textContent = def.tip;
    updateHud();
  }

  /**
   * 无尽墙:开局铺几行,每 5 发从顶上压一行下来,泡泡顶到警戒线就结束。
   * 成绩记在 `save.recordEndlessBest("bubble-aim", 分数)`。
   */
  function startEndless(): void {
    screen = "play";
    topBar.style.display = "";
    canvas.style.display = "";
    mapEl.style.display = "none";
    endless = true;
    endlessPoints = 0;
    rowsPushed = 0;
    chain = 0;
    floatTime = 0;
    swapFx = 0;
    grid = parseLayout(endlessStartRows(endlessPalette(0, ENDLESS_COLORS), Math.random));
    obstacles = {};
    dropQueue = [];
    dropEvery = 0;
    pressEvery = 0;
    pressLeft = 0;
    shotsTotal = 0;
    shotsLeft = Number.MAX_SAFE_INTEGER;
    shotsFired = 0;
    phase = "play";
    phaseTime = 0;
    bannerTime = 1.6;
    flight = null;
    aiming = false;
    pops.length = 0;
    falls.length = 0;
    cracks.length = 0;
    loader = freshLoader();
    msgEl.textContent = `♾️ 无尽墙:每 ${ENDLESS_PUSH_EVERY} 发压下一行,顶住!`;
    updateHud();
  }

  function retryLevel(): void {
    if (screen !== "play") return;
    api.play("tap");
    stopSpeaking();
    if (endless) startEndless();
    else startLevel(levelIndex);
  }

  function failLevel(reason: string): void {
    if (phase !== "play") return;
    phase = "failed";
    phaseTime = 0;
    failReason = reason;
    api.play("oops");
    msgEl.textContent = "没关系，点画面再来一次！";
    // 结算自动朗读：识字量有限的孩子靠听（无中文语音包时静默）
    speak(failedSpeechLine(reason));
  }

  function winLevel(): void {
    if (phase !== "play") return;
    phase = "won";
    phaseTime = 0;
    wonStars = starsForShotsLeft(shotsLeft, shotsTotal);
    const wasAllCleared = allCleared();
    progress.stars[levelIndex] = Math.max(progress.stars[levelIndex], wonStars);
    saveProgress(progress);
    api.play("win");
    msgEl.textContent = "全部清光，太棒啦！";
    // 剩下的石泡开心地掉下去
    for (let r = 0; r < grid.rows.length; r++) {
      for (let c = 0; c < rowLength(grid, r); c++) {
        const cell = grid.rows[r][c];
        if (cell && isStone(cell)) {
          pushFall(r, c, cell);
          grid.rows[r][c] = null;
        }
      }
    }
    if (!wasAllCleared && allCleared() && !allDoneReported) {
      allDoneReported = true;
      const sum = totalStars();
      const max = LEVELS.length * 3;
      const rating: 1 | 2 | 3 = sum / max >= 0.8 ? 3 : sum / max >= 0.5 ? 2 : 1;
      api.onWin(rating, `${LEVELS.length} 关泡泡战役全部通过，共 ${sum} 颗星！`);
    } else {
      // 逐关结算自动朗读（全通关那次走平台弹窗，那边自带朗读，不叠音）
      speak(wonSpeechLine(wonStars));
    }
  }

  function pushPop(r: number, c: number, color: string): void {
    const cc = cellCenter(grid, r, c);
    pops.push({ x: cc.x, y: cc.y, color, t: 0 });
  }

  function pushFall(r: number, c: number, color: string): void {
    const cc = cellCenter(grid, r, c);
    falls.push(makeFaller(cc.x, cc.y, color, ++fallSeed));
  }

  function fire(): void {
    if (phase !== "play" || flight || shotsLeft <= 0) return;
    const result = simulateShot(grid, SHOOTER_X, SHOOTER_Y, aimDx, aimDy, obstacles);
    shotsLeft--;
    flight = { result, seg: 0, segPos: 0, color: loader.current };
    // 上膛:下一颗顶上来,再补一颗(颜色只从墙上还有的里出)
    loader = reload(loader, grid, Math.random, specialsFor());
    api.play("jump");
    updateHud();
  }

  /** 换弹:当前和下一颗对调(逻辑立刻换;150ms 只是视觉过场,reduced 瞬时) */
  function swapAmmo(): void {
    if (phase !== "play" || flight) return;
    loader = swapLoader(loader);
    swapFx = softMotion ? 0 : BA_TIMINGS.swapMs;
    api.play("tap");
  }

  /**
   * 一发的结算:消掉的、掉下去的都记账。
   * 连着几发都有收获就叠连锁,掉落分翻倍还要飘字。
   */
  function scoreShot(popped: number, dropped: number): void {
    if (popped === 0 && dropped === 0) {
      chain = 0;
      return;
    }
    chain++;
    endlessPoints += chainScore(popped, dropped, chain);
    const label = chainLabel(dropped, chain);
    if (label) {
      floatText = label;
      floatSize = chainFontSize(chain);
      floatTime = 1.2;
    }
  }

  function landFlight(): void {
    if (!flight) return;
    const { result, color } = flight;
    flight = null;
    if (result.swallowed) {
      // 被黑洞吞掉：这发就没了
      api.play("oops");
      scoreShot(0, 0);
      afterShot();
      return;
    }
    if (result.hitCell && isStone(grid.rows[result.hitCell.r]?.[result.hitCell.c] ?? null)) {
      const { r, c } = result.hitCell;
      const cc = cellCenter(grid, r, c);
      const hit = damageStone(grid, r, c);
      if (hit.result === "cracked") {
        api.play("tap");
        cracks.push({ x: cc.x, y: cc.y, t: 0 });
      } else if (hit.result === "broken") {
        api.play("pop");
        pops.push({ x: cc.x, y: cc.y, color: STONE, t: 0 });
        for (const f of hit.dropped) pushFall(f.r, f.c, f.color);
        if (hit.dropped.length > 0) api.play("coin");
      }
      scoreShot(hit.result === "broken" ? 1 : 0, hit.dropped.length);
      afterShot();
      return;
    }
    if (!result.landing) {
      scoreShot(0, 0);
      afterShot();
      return;
    }
    const { r, c } = result.landing;
    // 炸弹泡:落到哪就把那一圈连石泡一起炸开,失联的照样往下掉
    if (isBomb(color)) {
      const blast = detonate(grid, r, c);
      api.play("pop");
      for (const p of blast.popped) pushPop(p.r, p.c, p.color);
      for (const f of blast.dropped) pushFall(f.r, f.c, f.color);
      if (blast.dropped.length > 0) api.play("coin");
      scoreShot(blast.popped.length, blast.dropped.length);
      afterShot();
      return;
    }
    grid.rows[r][c] = color;
    const settle = settleShot(grid, r, c);
    if (settle.popped.length > 0) {
      api.play("pop");
      for (const p of settle.popped) pushPop(p.r, p.c, p.color);
      for (const f of settle.dropped) pushFall(f.r, f.c, f.color);
      if (settle.dropped.length > 0) api.play("coin");
    } else {
      api.play("tap");
    }
    scoreShot(settle.popped.length, settle.dropped.length);
    afterShot();
  }

  function afterShot(): void {
    shotsFired++;
    // 孤零零的彩虹泡自己飞走
    for (const p of releaseLoneRainbows(grid)) pushPop(p.r, p.c, p.color);
    if (endless) {
      afterEndlessShot();
      return;
    }
    if (countBubbles(grid) === 0) {
      refreshQueue();
      updateHud();
      winLevel();
      return;
    }
    // 下落新行
    if (dropEvery > 0 && dropQueue.length > 0 && shotsFired % dropEvery === 0) {
      descend(grid, dropQueue.shift()!);
      api.play("jump");
      msgEl.textContent = "⬇️ 新的一排泡泡压下来啦！";
    }
    // 顶板下压：顶上多出一整层石板，整片泡泡往警戒线推一格
    if (pressEvery > 0 && pressLeft > 0 && shotsFired % pressEvery === 0) {
      pressCeiling(grid);
      pressLeft--;
      api.play("jump");
      msgEl.textContent = "🧊 顶板压下来一层，快清掉最下面那一串！";
    }
    refreshQueue();
    updateHud();
    if (crossedDeadline(grid)) {
      failLevel("泡泡越过警戒线啦！");
      return;
    }
    if (shotsLeft <= 0) {
      failLevel("子弹用完了！");
    }
  }

  /** 无尽墙的一发结算:每 5 发压一行,泡泡顶到警戒线就收工 */
  function afterEndlessShot(): void {
    if (endlessShouldPush(shotsFired)) {
      descend(grid, endlessRow(grid, endlessPalette(rowsPushed, ENDLESS_COLORS), Math.random, rowsPushed));
      rowsPushed++;
      api.play("jump");
      msgEl.textContent = "⬇️ 墙又压下来一行,顶住!";
    }
    if (countBubbles(grid) === 0) {
      // 清空了就补一批新的,无尽不该停在空屏。
      // 长度必须按 grid.flip 起头:descend 要的是 rowLen(flip ^ 1, 0),
      // 而 flip 每压一行翻一次,给错了 parseRow 会抛异常(C2-02)
      const palette = endlessPalette(rowsPushed, ENDLESS_COLORS);
      for (const line of endlessStartRows(palette, Math.random, 2, grid.flip ^ 1)) {
        descend(grid, line);
      }
      msgEl.textContent = "清空啦!新的一波泡泡来喽~";
    }
    refreshQueue();
    updateHud();
    if (crossedDeadline(grid)) endEndless();
  }

  function endEndless(): void {
    if (phase !== "play") return;
    phase = "failed";
    phaseTime = 0;
    const total = endlessTotal(endlessPoints, rowsPushed);
    failReason = `顶住了 ${rowsPushed} 行!`;
    api.play("oops");
    msgEl.textContent = endlessLine(total, bestEndless);
    speak(endlessLine(total, bestEndless));
    save.recordEndlessBest(meta.id, total);
    bestEndless = Math.max(bestEndless, total);
  }

  // ---------- 绘制 ----------

  /** 石泡:岩石棱面三块 + 裂纹两态(读既有 cracked 状态,只换皮不写状态) */
  function drawStoneAt(x: number, y: number, cracked: boolean, radius = R, alpha = 1): void {
    paintStoneRock(ctx, x, y, radius, cracked, alpha);
  }

  /** 彩虹泡:旋转七彩环 + 中心白星(reduced 静止) */
  function drawRainbowAt(x: number, y: number, radius = R, alpha = 1): void {
    paintRainbowOrb(ctx, x, y, radius, rainbowSpinAngle(animTime * 1000, softMotion), alpha);
  }

  /** 炸弹泡:可爱黑猫(耳朵 + 引信星火;reduced 静止火点),不是武器 */
  function drawBombAt(x: number, y: number, radius = R, alpha = 1): void {
    paintBombCat(ctx, x, y, radius, fuseSparkPhase(animTime * 1000, softMotion), alpha);
  }

  function drawBubbleAt(x: number, y: number, color: string, radius = R, alpha = 1): void {
    if (color === BOMB) {
      drawBombAt(x, y, radius, alpha);
      return;
    }
    if (color === STONE || color === STONE_CRACKED) {
      drawStoneAt(x, y, stoneCracked(color), radius, alpha);
      return;
    }
    if (color === RAINBOW) {
      drawRainbowAt(x, y, radius, alpha);
      return;
    }
    // 薄膜描边 + 月牙反光 + 双高光 + 色觉标记(标记最后画,永不被盖)全在 paintBubble 里
    const [light, dark] = COLOR_FILL[color] ?? COLOR_FILL.R;
    paintBubble(ctx, x, y, radius, light, dark, color, alpha);
  }

  function drawBackground(): void {
    const th = THEMES[themeOfLevel(levelIndex)];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (endless) {
      // 无尽墙不属于任何主题世界:用本档自己的双色渐变
      g.addColorStop(0, BA_COLORS.baBgTop);
      g.addColorStop(1, BA_COLORS.baBgBottom);
    } else {
      g.addColorStop(0, th.skyTop);
      g.addColorStop(1, th.skyBottom);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 远处光斑两粒(静态纵深,reduced 保留)
    paintLightBlobs(ctx, W, H);
    // 顶部藤蔓吊灯装饰带:泡泡从藤架上垂下;顶板/墙压得越多藤影越深
    const pressed = endless
      ? rowsPushed
      : pressEvery > 0 ? Math.max(0, (LEVELS[levelIndex].pressMax ?? 0) - pressLeft) : 0;
    paintVineLampBand(ctx, W, vineShadowAlpha(pressed));
    if (!endless && th.dark) {
      // 夜空主题:一闪一闪的小星星
      for (let k = 0; k < 26; k++) {
        const sx = (k * 73.7 + 11) % W;
        const sy = (k * 137.3 + 23) % (H - 130);
        ctx.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(animTime * 2 + k * 1.7));
        ctx.fillStyle = "#FFF6D8";
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    // 警戒线:泡泡压到上一行时提前闪烁预警
    const dy = TOP + R + DEADLINE_ROW * ROW_H - R - 4;
    const danger = phase === "play" && nearDeadline(grid);
    const blink = danger ? 0.55 + 0.45 * Math.sin(animTime * 9) : 0;
    ctx.strokeStyle = danger
      ? `rgba(255, 70, 100, ${0.55 + blink * 0.45})`
      : th.dark ? "rgba(255, 170, 190, 0.85)" : "rgba(255, 130, 150, 0.55)";
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = danger ? 3 + blink * 1.5 : 2;
    ctx.beginPath();
    ctx.moveTo(8, dy);
    ctx.lineTo(W - 8, dy);
    ctx.stroke();
    ctx.setLineDash([]);
    if (danger) {
      ctx.fillStyle = `rgba(255, 70, 100, ${0.6 + blink * 0.4})`;
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚠️ 快到警戒线啦!", W / 2, dy + 16);
      ctx.textAlign = "left";
    }
  }

  function drawObstacles(): void {
    for (const hole of obstacles.holes ?? []) {
      const grad = ctx.createRadialGradient(hole.x, hole.y, 2, hole.x, hole.y, HOLE_R);
      grad.addColorStop(0, "#1B1433");
      grad.addColorStop(0.6, "#3A2C66");
      grad.addColorStop(1, "rgba(90, 70, 150, 0.15)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, HOLE_R, 0, Math.PI * 2);
      ctx.fill();
      // 旋转的吸入弧线
      ctx.strokeStyle = "rgba(190, 170, 255, 0.8)";
      ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        const a = animTime * 2.4 + k * Math.PI;
        ctx.beginPath();
        ctx.arc(hole.x, hole.y, HOLE_R * 0.62, a, a + 1.6);
        ctx.stroke();
      }
    }
    for (const cl of obstacles.clouds ?? []) {
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.beginPath();
      ctx.roundRect(cl.x, cl.y, cl.w, cl.h, cl.h / 2);
      ctx.fill();
      // 云朵鼓包
      const bumps = 3;
      for (let k = 0; k < bumps; k++) {
        const bx = cl.x + (cl.w * (k + 0.5)) / bumps;
        ctx.beginPath();
        ctx.arc(bx, cl.y + 2, cl.h * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(150, 180, 215, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cl.x, cl.y, cl.w, cl.h, cl.h / 2);
      ctx.stroke();
    }
  }

  function drawGrid(): void {
    for (let r = 0; r < grid.rows.length; r++) {
      for (let c = 0; c < rowLength(grid, r); c++) {
        const color = grid.rows[r][c];
        if (!color) continue;
        const cc = cellCenter(grid, r, c);
        drawBubbleAt(cc.x, cc.y, color);
      }
    }
    // 贴附成串的软泡泡之间点一粒挤压高光(静态体积感,reduced 保留);
    // 只挑「后面」的邻居,每对只画一次。只读网格,不写任何格子。
    for (let r = 0; r < grid.rows.length; r++) {
      for (let c = 0; c < rowLength(grid, r); c++) {
        if (!isSquashy(grid.rows[r][c])) continue;
        const a = cellCenter(grid, r, c);
        for (const [nr, nc] of neighbors(grid, r, c)) {
          if (nr < r || (nr === r && nc <= c)) continue;
          if (!isSquashy(grid.rows[nr][nc])) continue;
          const b = cellCenter(grid, nr, nc);
          paintSqueezeDot(ctx, a.x, a.y, b.x, b.y);
        }
      }
    }
  }

  function drawAim(): void {
    if (!aiming || phase !== "play" || flight) return;
    // 和 fire() 完全一样的调用 → 指哪打哪;但只把开头一小段(最多一次反射)画出来,
    // 剩下的留给小朋友自己判断,不把整条解直接送到眼前。
    const result = simulateShot(grid, SHOOTER_X, SHOOTER_Y, aimDx, aimDy, obstacles);
    const shown = previewPath(result.path);
    // 渐隐圆点串(功能件,reduced 保留):点径沿路径 4→2px 递减;
    // 每个点都沿既有物理折线取样,一个物理坐标都不自己算。
    const tone = result.swallowed ? "120, 90, 200" : "90, 150, 220";
    for (const d of aimDots(shown)) {
      ctx.fillStyle = `rgba(${tone}, ${(0.85 - d.t * 0.4).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, aimDotRadius(d.t), 0, Math.PI * 2);
      ctx.fill();
    }
    // 反弹点小星花:就是物理反射点本身,原样标出来
    for (const s of bounceStars(shown)) paintBounceStar(ctx, s.x, s.y);
    // 预览线断掉的地方画个淡淡的箭头,提示「还会继续往那边飞」
    const tip = shown[shown.length - 1];
    const prev = shown[shown.length - 2];
    if (tip && prev) {
      const a = Math.atan2(tip.y - prev.y, tip.x - prev.x);
      ctx.fillStyle = "rgba(90, 150, 220, 0.55)";
      ctx.beginPath();
      ctx.moveTo(tip.x + Math.cos(a) * 9, tip.y + Math.sin(a) * 9);
      ctx.lineTo(tip.x + Math.cos(a + 2.5) * 7, tip.y + Math.sin(a + 2.5) * 7);
      ctx.lineTo(tip.x + Math.cos(a - 2.5) * 7, tip.y + Math.sin(a - 2.5) * 7);
      ctx.closePath();
      ctx.fill();
    }
    // 当前角度:远端拖动时看得见微调到了第几档
    ctx.fillStyle = "rgba(62, 124, 184, 0.85)";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${aimDeg.toFixed(fineAim ? 1 : 0)}°`, SHOOTER_X, SHOOTER_Y + R + 26);
    ctx.textAlign = "left";
    if (result.hitCell && isStone(grid.rows[result.hitCell.r]?.[result.hitCell.c] ?? null)) {
      // 会砸到石泡：画个小炸花
      const cc = cellCenter(grid, result.hitCell.r, result.hitCell.c);
      ctx.strokeStyle = "rgba(240, 160, 90, 0.9)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        ctx.moveTo(cc.x + Math.cos(a) * (R - 6), cc.y + Math.sin(a) * (R - 6));
        ctx.lineTo(cc.x + Math.cos(a) * (R + 4), cc.y + Math.sin(a) * (R + 4));
      }
      ctx.stroke();
    }
  }

  /**
   * 发射器炮台六道工序(四·补二):落影 → 木底座 → 旋转炮管(只读瞄准角)→
   * 星星徽章 → 装填槽待命泡(±2px 弹跳,reduced 静止)→ 换弹 150ms 旋转过场。
   * 逻辑上 swapLoader 早在按下那一刻换完,这里只演过场。
   */
  function drawShooter(): void {
    paintShooterShadow(ctx, SHOOTER_X, SHOOTER_Y, R);
    paintShooterBase(ctx, SHOOTER_X, SHOOTER_Y, R);
    paintBarrel(ctx, SHOOTER_X, SHOOTER_Y, barrelAngle({ dx: aimDx, dy: aimDy }), R);
    // 座舱圈(沿用原白圈,压在炮管根部上)
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(SHOOTER_X, SHOOTER_Y, R + 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#BFD9F2";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = THEMES[themeOfLevel(levelIndex)].dark ? "rgba(255,255,255,0.85)" : "#5E86B0";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("下一个", NEXT_X, SHOOTER_Y - 24);
    ctx.textAlign = "left";
    paintLoadSlot(ctx, NEXT_X, NEXT_Y, R * 0.7);
    if (phase === "play" && swapFx > 0) {
      // 换弹过场:两颗泡上下弧对转 150ms;槽里那颗小、炮位那颗随进度长大
      const p = swapProgress(BA_TIMINGS.swapMs - swapFx, softMotion);
      const pos = swapPositions(p, SHOOTER_X, SHOOTER_Y, NEXT_X, NEXT_Y);
      if (shotsLeft > 1) drawBubbleAt(pos.nxt.x, pos.nxt.y, loader.next, R * (1 - 0.3 * p));
      if (shotsLeft > 0) drawBubbleAt(pos.cur.x, pos.cur.y, loader.current, R * (0.7 + 0.3 * p));
    } else {
      if (phase === "play" && shotsLeft > 1) {
        drawBubbleAt(NEXT_X, NEXT_Y + bounceOffset(animTime * 1000, softMotion), loader.next, R * 0.7);
      }
      if (phase === "play" && shotsLeft > 0) {
        drawBubbleAt(SHOOTER_X, SHOOTER_Y, loader.current);
      }
    }
    paintStarBadge(ctx, SHOOTER_X, SHOOTER_Y + R * 1.05, R);
  }

  /** 连锁飘字:白描边 + 轻弹入场(reduced 直接满尺寸),掉得越多字越大,慢慢升起 */
  function drawFloatText(dt: number): void {
    if (floatTime <= 0 || !floatText) return;
    floatTime -= dt;
    const k = Math.max(0, Math.min(1, floatTime / 1.2));
    const pop = softMotion ? 1 : floatPopScale(k);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = "#F0872F";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 4;
    ctx.font = `bold ${floatSize}px sans-serif`;
    ctx.textAlign = "center";
    const y = SHOOTER_Y - 70 - (1 - k) * 40;
    ctx.translate(W / 2, y);
    ctx.scale(pop, pop);
    ctx.strokeText(floatText, 0, 0);
    ctx.fillText(floatText, 0, 0);
    ctx.restore();
  }

  function drawFlight(): void {
    if (!flight) return;
    const path = flight.result.path;
    const seg = path[flight.seg];
    const next = path[flight.seg + 1];
    if (!next) return;
    const segLen = Math.hypot(next.x - seg.x, next.y - seg.y) || 1;
    const t = flight.segPos / segLen;
    const x = seg.x + (next.x - seg.x) * t;
    const y = seg.y + (next.y - seg.y) * t;
    // 被黑洞吞时越飞越小
    let radius = R;
    if (flight.result.swallowed && flight.seg >= path.length - 2) {
      radius = R * Math.max(0.15, 1 - t);
    }
    drawBubbleAt(x, y, flight.color, radius);
  }

  /**
   * 掉落串(图层④):先画拖尾残影(3 帧渐隐,reduced 不生成),再推重力画本体。
   * 掉落仍走 aim12 的重力:一帧一帧经过中间位置,关掉动效也只是掉得更快。
   */
  function drawFalls(dt: number): void {
    for (let i = trails.length - 1; i >= 0; i--) {
      const tr = trails[i];
      tr.life -= 1;
      if (tr.life <= 0) {
        trails.splice(i, 1);
        continue;
      }
      const k = tr.life / BA_TIMINGS.trailFrames;
      ctx.globalAlpha = 0.28 * k;
      ctx.fillStyle = (COLOR_FILL[tr.color] ?? COLOR_FILL.R)[1];
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, R * (0.7 + 0.2 * k), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const trailLife = trailFrames(softMotion);
    for (let i = falls.length - 1; i >= 0; i--) {
      const before = falls[i];
      if (trailLife > 0) trails.push({ x: before.x, y: before.y, color: before.color, life: trailLife });
      const stepped = stepFaller(before, dt, fallGravity(softMotion));
      falls[i] = stepped;
      if (fallenOut(stepped)) {
        falls.splice(i, 1);
        continue;
      }
      drawBubbleAt(stepped.x, stepped.y, stepped.color, R, Math.max(0.3, 1 - stepped.age * 0.6));
    }
  }

  function drawAnims(dt: number): void {
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.t += dt;
      if (p.t > 0.32) {
        pops.splice(i, 1);
        continue;
      }
      const k = p.t / 0.32;
      drawBubbleAt(p.x, p.y, p.color, R * (1 + k * 0.5), 1 - k);
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * (1 + k), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = cracks.length - 1; i >= 0; i--) {
      const cfx = cracks[i];
      cfx.t += dt;
      if (cfx.t > 0.4) {
        cracks.splice(i, 1);
        continue;
      }
      const k = cfx.t / 0.4;
      ctx.strokeStyle = `rgba(255, 200, 90, ${1 - k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cfx.x, cfx.y, R + k * 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawOverlays(): void {
    if (bannerTime > 0 && phase === "play" && endless) {
      const a = Math.min(1, bannerTime / 0.4);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * a})`;
      ctx.beginPath();
      ctx.roundRect(30, 178, 300, 92, 18);
      ctx.fill();
      ctx.fillStyle = `rgba(62, 124, 184, ${a})`;
      ctx.font = "bold 21px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("♾️ 无尽墙", W / 2, 212);
      ctx.font = "13px sans-serif";
      ctx.fillText(`每 ${ENDLESS_PUSH_EVERY} 发压下一行,能顶多久?`, W / 2, 238);
      ctx.fillText(`最好成绩 ${bestEndless} 分`, W / 2, 258);
      ctx.textAlign = "left";
    } else if (bannerTime > 0 && phase === "play") {
      const a = Math.min(1, bannerTime / 0.4);
      const def = LEVELS[levelIndex];
      const th = THEMES[themeOfLevel(levelIndex)];
      const mechs = levelMechanisms(def);
      const note = budgetNote(def);
      const extraLines = (mechs.length > 0 ? 1 : 0) + (note ? 1 : 0);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * a})`;
      ctx.beginPath();
      ctx.roundRect(30, 168, 300, 100 + extraLines * 20, 18);
      ctx.fill();
      ctx.fillStyle = `rgba(62, 124, 184, ${a})`;
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${th.icon} ${th.name}`, W / 2, 192);
      ctx.font = "bold 21px sans-serif";
      ctx.fillText(`第 ${levelIndex + 1} 关 · ${def.name}`, W / 2, 220);
      ctx.font = "12px sans-serif";
      let y = 248;
      ctx.fillText(def.tip, W / 2, y);
      if (mechs.length > 0) {
        y += 24;
        ctx.fillText("机关：" + mechs.map((m) => MECH_INFO[m].icon + MECH_INFO[m].name).join(" "), W / 2, y);
      }
      if (note) {
        y += 24;
        ctx.fillText(note, W / 2, y);
      }
      ctx.textAlign = "left";
    }
    if (phase === "won") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.roundRect(60, 170, 240, 120, 20);
      ctx.fill();
      ctx.fillStyle = "#3E7CB8";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("清空啦！", W / 2, 210);
      ctx.font = "26px sans-serif";
      ctx.fillText("⭐".repeat(wonStars) + "☆".repeat(3 - wonStars), W / 2, 248);
      // 14px 深蓝：小字对比 5.5:1（标题的 #3E7CB8 只有 4.4:1，13px 小字不达 AA）
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#3a6c9e";
      ctx.fillText(
        levelIndex + 1 < LEVELS.length ? "马上进入下一关…" : "最后一关通关！",
        W / 2, 276
      );
      ctx.textAlign = "left";
    }
    if (phase === "failed") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.roundRect(50, 180, 260, 100, 20);
      ctx.fill();
      ctx.fillStyle = "#E0708C";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(failReason, W / 2, 220);
      ctx.font = "14px sans-serif";
      // 深蓝：小字对比 5.8:1（原 #5E86B0 只有 3.8:1，不达 AA）
      ctx.fillStyle = "#46688f";
      ctx.fillText(endless ? "点击画面再来一局" : "点击画面重试本关", W / 2, 252);
      ctx.textAlign = "left";
    }
  }

  /** 图层序(四·补一):①背景+光斑 ②藤蔓吊灯(都在 drawBackground)→ 机关 → ③网格串
   *  → ④掉落拖尾 → ⑤飞行泡 → ⑥瞄准点串(功能件) → ⑦炮台 → ⑧星花/飘分 → ⑨HUD */
  function draw(dt: number): void {
    drawBackground();
    drawObstacles();
    drawGrid();
    drawFalls(dt);
    drawFlight();
    drawAim();
    drawShooter();
    drawAnims(dt);
    drawFloatText(dt);
    drawOverlays();
  }

  // ---------- 主循环 ----------

  function tick(now: number): void {
    if (destroyed) return;
    // 先把下一帧排上,再干活。
    // 原来这句写在函数最后一行,一旦中间任何一步抛异常,重新排帧就永远执行不到,
    // 整条 rAF 循环当场断掉——画面不动、按钮没反应,只能退出重进(C2-02 就是这么卡死的)。
    // 排在最前面,逻辑出问题最多是这一帧画歪,不会把整局带走。
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    animTime += dt;
    phaseTime += dt;
    if (bannerTime > 0) bannerTime -= dt;
    if (swapFx > 0) swapFx = Math.max(0, swapFx - dt * 1000);

    if (screen === "play") {
      // 飞行推进
      if (flight) {
        let travel = FLY_SPEED * dt;
        while (travel > 0 && flight) {
          const path = flight.result.path;
          const seg = path[flight.seg];
          const next = path[flight.seg + 1];
          if (!next) {
            landFlight();
            break;
          }
          const segLen = Math.hypot(next.x - seg.x, next.y - seg.y);
          const remain = segLen - flight.segPos;
          if (travel >= remain) {
            travel -= remain;
            flight.seg++;
            flight.segPos = 0;
            if (flight.seg >= path.length - 1) {
              landFlight();
              break;
            }
          } else {
            flight.segPos += travel;
            travel = 0;
          }
        }
      }

      if (phase === "won" && phaseTime > 1.8) {
        if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
        else showMap();
      }

      draw(dt);
    }
  }

  // ---------- 输入 ----------

  function toCanvas(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function setAim(p: { x: number; y: number }): boolean {
    // 拖得越远,角度吸附得越细 —— 远端 1px 抖动不会再让弹道乱飞
    const aim = aimFromDrag(SHOOTER_X, SHOOTER_Y, p.x, p.y);
    if (!aim) return false; // 只能向上瞄准
    aimDx = aim.dx;
    aimDy = aim.dy;
    aimDeg = aim.deg;
    fineAim = angleStepDeg(Math.hypot(p.x - SHOOTER_X, p.y - SHOOTER_Y)) < COARSE_STEP_DEG;
    return true;
  }

  let pressing = false;
  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    if (screen !== "play") return;
    if (phase === "failed") {
      retryLevel();
      return;
    }
    if (phase !== "play" || flight) return;
    pressing = true;
    aiming = setAim(toCanvas(e));
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!pressing || phase !== "play" || flight) return;
    // 按住期间持续更新：从发射台往上拖也能获得有效瞄准
    aiming = setAim(toCanvas(e)) || aiming;
  };
  const onPointerUp = (): void => {
    if (pressing && aiming && phase === "play" && !flight) fire();
    pressing = false;
    aiming = false;
  };
  const onPointerCancel = (): void => {
    // 系统手势打断:收起瞄准线但不发射,子弹不浪费
    pressing = false;
    aiming = false;
  };

  // Tab 换弹:手机点 🔀 钮,键盘按 Tab,两边等价
  const onKeyDown = (e: KeyboardEvent): void => {
    if (screen !== "play") return;
    if (e.key === "Tab") {
      e.preventDefault();
      swapAmmo();
    }
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("keydown", onKeyDown);
  retryBtn.addEventListener("click", retryLevel);
  swapBtn.addEventListener("click", swapAmmo);
  endlessBtn.addEventListener("click", () => {
    api.play("tap");
    startEndless();
  });
  backBtn.addEventListener("click", () => {
    api.play("tap");
    showMap();
  });

  showMap();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      stopSpeaking();
      // 粒子与计时当场归零,不留尾巴
      pops.length = 0;
      falls.length = 0;
      trails.length = 0;
      cracks.length = 0;
      floatText = "";
      floatTime = 0;
      swapFx = 0;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      wrap.remove();
    },
    /** 测试探针:还挂着多少视觉粒子 / 计时(destroy 后必须是 0) */
    fxCount() {
      return pops.length + falls.length + trails.length + cracks.length +
        (floatTime > 0 ? 1 : 0) + (swapFx > 0 ? 1 : 0);
    },
  };
}
