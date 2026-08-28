import { meta } from "./meta";
export { meta };

// 音符下落 —— 四条轨的下落式点击。
//
// 判定、谱面、关卡、假人全在 judge.ts / chart.ts / run.ts / levels.ts / ai.ts 里,
// 这个文件只负责把它们摆到屏幕上:Canvas 画四列和判定线,音符压到线上就点,
// 长按条要按住到尾,命中会碎成往上飘的小音符。
// 四种玩法都在这儿:188 关闯关、同谱对战、无尽加速、双人分轨。
import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { TIER_NAMES, aiRun, tierLine, type AiTier } from "./ai";
import {
  BEAM_COUNT,
  COMBO_SHOW_MIN,
  LANE_COLORS,
  LANE_OFF,
  LANE_SOFT,
  RING_MS,
  STAGE_THEMES,
  WARM_COMBO,
  beamAngle,
  beamTint,
  burstSprite,
  comboScale,
  countdownStep,
  gradeLabelSprite,
  noteSprite,
  rgbaOf,
  shadeHex,
  sparkSprite,
  themeForChapter,
  traceLaneSymbol,
  tracePill,
  pauseIconSVG,
  playIconSVG,
  traceStar,
  type BurstGrade,
} from "./art";
import { createToneKit, type ToneKit } from "./audio";
import { LANE_COUNT, type Chart } from "./chart";
import guideBook from "./guide";
import { CAMPAIGN_MAX_MISS, MISS_LINE, approachMs, endlessSpeedAt } from "./judge";
import {
  CHAPTERS,
  buildLevel,
  endlessWave,
  levelBrief,
  levelChart,
  levelRules,
  levelStars,
  loseLine,
  matchChart,
  winLine,
} from "./levels";
import {
  ENDLESS_RULES,
  advanceTo,
  createRun,
  releaseLane,
  tapLane,
  type RunEvent,
  type RunRules,
  type RunState,
} from "./run";

// ---------------------------------------------------------------------------
// 尺寸与配色
// ---------------------------------------------------------------------------

/** 判定线放在画布 80% 高度处 */
export const JUDGE_LINE_RATIO = 0.8;
/** 每一列的最小宽度:360px 屏也要留得住手指 */
export const MIN_LANE_PX = 80;

function viewportWidth(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  return typeof w === "number" && w > 0 ? w : 480;
}

function reduceMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return mm ? mm("(prefers-reduced-motion: reduce)").matches === true : false;
  } catch {
    return false;
  }
}

/** 画布宽度:窄屏占满,宽屏封顶,永远保证四列各自 ≥ 80px */
export function stageWidth(viewport: number): number {
  const w = Number.isFinite(viewport) && viewport > 0 ? viewport : 480;
  return Math.max(MIN_LANE_PX * LANE_COUNT, Math.min(460, Math.round(w - 24)));
}

/** 每一列有多宽 */
export function laneWidthAt(viewport: number): number {
  return stageWidth(viewport) / LANE_COUNT;
}

/** 再挤也不让画布矮过这个数,不然音符没有下落的距离 */
export const MIN_STAGE_PX = 190;

/**
 * 画布高度:比宽度略高一点给下落留距离,但矮屏上要让出空间,
 * 保证判定线连同下面的提示一起留在首屏里,不用滚动就能玩。
 */
export function stageHeight(width: number, viewportHeight = 0): number {
  const roomy = Math.min(540, Math.round(width * 1.24));
  const fits = viewportHeight > 0 ? viewportHeight - 300 : roomy;
  return Math.max(MIN_STAGE_PX, Math.min(roomy, Math.max(MIN_STAGE_PX, fits)));
}

/**
 * 平台舞台是 overflow:hidden 的,判定线一旦被挤到舞台外面就再也点不着。
 * 所以拿量出来的可用高度再收一刀:够宽敞就用 `roomy`,不够就贴着可用高度走。
 */
export function fitStageHeight(roomy: number, availablePx: number): number {
  if (!Number.isFinite(availablePx) || availablePx <= 0) return roomy;
  return Math.max(MIN_STAGE_PX, Math.min(roomy, Math.round(availablePx)));
}

function viewportHeightPx(): number {
  const h = (globalThis as { innerHeight?: number }).innerHeight;
  return typeof h === "number" && h > 0 ? h : 0;
}

/**
 * 往上找真正裁人的那条底边:`.game-stage` 之外,壳层的关卡包装(l99-stage-wrap)
 * 和 wrap 自己都是 overflow:hidden,矮横屏上它们比舞台更早把画布剪掉(N-90:
 * 915×412 实测 wrap 底 336、舞台底 404,判定线躲在 336 以下就再也看不见)。
 * 逐层取最小的底边;一层都量不到就退回视口底。
 */
function clipBottomPx(el: HTMLElement | null): number {
  let node: HTMLElement | null = el;
  let best = 0;
  for (let i = 0; node && i < 8; i++) {
    const cls = typeof node.className === "string" ? node.className : "";
    let clips = cls.includes("game-stage");
    if (!clips && typeof getComputedStyle === "function") {
      try {
        const o = getComputedStyle(node).overflowY;
        clips = o === "hidden" || o === "clip";
      } catch {
        clips = false;
      }
    }
    if (clips) {
      const r = node.getBoundingClientRect?.();
      if (r && r.bottom > 0) best = best === 0 ? r.bottom : Math.min(best, r.bottom);
      if (cls.includes("game-stage")) break;
    }
    node = node.parentElement;
  }
  return best > 0 ? best : viewportHeightPx();
}

/**
 * N-90:画布高被 MIN_STAGE_PX 兜底后仍可能伸出剪裁盒(壳层矮横屏只给 ~164px)。
 * 判定是纯时间制(approachMs 固定毫秒),把判定线的高度比例往上收不改难度,
 * 只是音符下落的像素路径变短。收到底也不低于 0.45,画布够住时保持 0.8 不动。
 */
export function fitJudgeRatio(stagePx: number, canvasTop: number, clipBottom: number): number {
  if (!Number.isFinite(stagePx) || stagePx <= 0) return JUDGE_LINE_RATIO;
  if (!Number.isFinite(canvasTop) || !Number.isFinite(clipBottom) || clipBottom <= canvasTop) {
    return JUDGE_LINE_RATIO;
  }
  // 线下留 14px 白:判定线本身不许贴着剪裁边,不然「压线」的音符看不见尾巴
  const ratio = (clipBottom - canvasTop - 14) / stagePx;
  return Math.max(0.45, Math.min(JUDGE_LINE_RATIO, ratio));
}

// 调色板与 sprite 都在 art.ts:index 只负责拼装,不再逐帧手绘

/** 四轨键位:单人 D F J K */
export const KEYS_SOLO = ["d", "f", "j", "k"];
/** 双人分轨:朵朵 A S 管左两轨,星星 K L 管右两轨 */
export const KEYS_DUO = ["a", "s", "k", "l"];

/**
 * 双人分轨的备用键(主键 A / S / K / L 一个都没换,这里只是多认几个):
 * 朵朵的 D 和 S 同轨,这样她左右手就是 A / D;星星的 ← → 和 K / L 同轨,
 * 向「星星用方向键」的统一口径靠拢。
 */
export const ALIAS_DUO: Readonly<Record<string, number>> = {
  d: 1,
  arrowleft: 2,
  arrowright: 3,
};

/** 一个键对应哪条轨;不是本款的键返回 -1 */
export function laneForKey(key: string, split: boolean): number {
  const k = (key ?? "").toLowerCase();
  const main = (split ? KEYS_DUO : KEYS_SOLO).indexOf(k);
  if (main >= 0) return main;
  return split ? (ALIAS_DUO[k] ?? -1) : -1;
}

/** 点在画布上的横坐标落在第几列 */
export function laneForX(x: number, width: number): number {
  if (!(width > 0)) return -1;
  const lane = Math.floor((x / width) * LANE_COUNT);
  return Math.max(0, Math.min(LANE_COUNT - 1, lane));
}

const CSS = `
.tt-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;
  align-items:center;background:linear-gradient(180deg,#F7F1FF,#EDF3FF);border-radius:18px;padding:10px;
  position:relative;overflow:hidden;}
.tt-banner{text-align:center;font-size:14px;font-weight:800;color:#6b4fa0;line-height:1.5;}
.tt-banner:empty{display:none;}
/* 计分行不换行:暂停键掉到第二行的话,判定线就被顶出舞台了 */
.tt-hud{display:flex;gap:8px;flex-wrap:nowrap;justify-content:center;align-items:center;width:100%;}
.tt-stats{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;flex:1 1 auto;min-width:0;}
.tt-stat{background:#ffffffdd;border-radius:999px;padding:4px 12px;font-size:16px;font-weight:900;color:#5f4a8a;
  box-shadow:0 2px 6px rgba(150,130,200,.2);}
.tt-stat-combo{color:#b8446f;}
.tt-stat-life{color:#7a6a3f;background:#fff6dd;}
.tt-canvas{border-radius:16px;background:#FBF7FF;box-shadow:0 4px 14px rgba(150,130,200,.22);display:block;
  touch-action:none;}
.tt-say{font-size:14px;font-weight:800;color:#7a6aa6;text-align:center;min-height:20px;line-height:1.4;}
.tt-say-miss{color:#8b7fae;}
.tt-keys{font-size:14px;font-weight:700;color:#8b7ead;text-align:center;line-height:1.6;}
.tt-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.tt-btns:empty{display:none;}
.tt-btn{border:none;border-radius:14px;min-height:44px;padding:8px 16px;font-size:15px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#5b4a7a;background:#efe9ff;box-shadow:0 3px 0 rgba(140,120,190,.4);}
.tt-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.4);}
.tt-btn-go{background:linear-gradient(180deg,#a98bea,#8a6ad6);color:#fff;box-shadow:0 3px 0 #6d51b4;}
.tt-btn-go:active{box-shadow:0 1px 0 #6d51b4;}
.tt-btn:focus-visible,.tt-open:focus-visible,.tt-goback:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.tt-cover{position:absolute;inset:0;background:rgba(252,248,255,.97);border-radius:18px;z-index:20;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:18px;}
.tt-cover-t{font-size:20px;font-weight:900;color:#6b4fa0;}
.tt-cover-s{font-size:15px;font-weight:700;color:#7a6aa6;line-height:1.6;max-width:320px;}
.tt-btn-pause{flex:0 0 auto;min-width:44px;padding:8px 12px;}
.tt-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:8px;}
/* 关内要把这一排收起来腾竖向空间;类选择器的 display 会盖过 [hidden],得写回来 */
.tt-bar[hidden]{display:none;}
.tt-open{border:none;border-radius:999px;padding:10px 16px;min-height:44px;font-size:15px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#fff;background:linear-gradient(180deg,#a98bea,#8a6ad6);
  box-shadow:0 4px 0 #6d51b4;}
.tt-open.tt-open-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.tt-open.tt-open-duo{background:linear-gradient(180deg,#7fc7a4,#4fa37c);box-shadow:0 4px 0 #3b7f60;}
.tt-open:active{transform:translateY(2px);box-shadow:0 2px 0 #6d51b4;}
.tt-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#F6F2FF,#FFF4FA);display:flex;flex-direction:column;gap:8px;}
.tt-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.tt-goback{border:none;border-radius:999px;padding:8px 13px;min-height:44px;font-size:14px;font-weight:900;
  cursor:pointer;font-family:inherit;background:#ffffffdd;color:#6a52a0;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.tt-goback:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.tt-chip{background:#ffffffdd;border-radius:999px;padding:5px 11px;font-size:14px;font-weight:800;color:#6a5892;
  box-shadow:0 2px 5px rgba(150,140,190,.18);}
.tt-over{border-radius:16px;background:#fffdfa;padding:14px;text-align:center;display:flex;
  flex-direction:column;gap:10px;align-items:center;box-shadow:0 3px 10px rgba(160,150,190,.25);}
.tt-over-t{font-size:20px;font-weight:900;color:#6a4fa8;}
.tt-over-s{font-size:15px;font-weight:700;color:#6f6390;line-height:1.6;}
.tt-sum{display:flex;flex-direction:column;gap:8px;width:100%;max-width:300px;align-items:center;}
.tt-sum-bar{display:flex;width:100%;height:14px;border-radius:999px;overflow:hidden;background:#efeaf6;}
.tt-seg-p{background:linear-gradient(180deg,#ffd98a,#f5b953);}
.tt-seg-g{background:linear-gradient(180deg,#a8d8f8,#7fc9f5);}
.tt-seg-m{background:#d9d3e6;}
.tt-sum-legend{font-size:14px;font-weight:800;color:#7a6aa6;}
.tt-sum-badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.tt-badge{background:#fff;border-radius:999px;padding:4px 12px;font-size:14px;font-weight:900;color:#6a4fa8;
  box-shadow:0 2px 6px rgba(150,130,200,.2);}
.tt-badge-star{color:#d99a1f;background:#fff6dd;}
.tt-duo-cols{display:flex;gap:10px;width:100%;justify-content:center;}
.tt-duo-col{flex:1 1 0;background:#f6f2ff;border-radius:12px;padding:8px;font-size:14px;font-weight:800;
  color:#6a5892;line-height:1.7;}
@media (max-width:420px){
  .tt-wrap{padding:8px;gap:6px;}
  .tt-stat{padding:4px 10px;}
}
/* 比规格下限还窄的老机器:收横向内边距把计分挤回一行,字号仍旧留在 16px */
@media (max-width:340px){
  .tt-hud{gap:6px;}
  .tt-stat{padding:4px 7px;}
}
/* N-90:矮横屏壳层只给画布 ~164px。键盘提示行让位(触屏直接点轨道),
   旁白浮到画布底角不占行高;判定线经 fitJudgeRatio 收进可视区(时间制判定,难度不变) */
@media (max-height:500px){
  .tt-wrap{padding:6px;gap:4px;}
  .tt-keys{display:none;}
  .tt-say{position:absolute;left:50%;bottom:2px;transform:translateX(-50%);z-index:3;
    max-width:94%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    background:rgba(255,255,255,.88);border-radius:10px;padding:1px 10px;pointer-events:none;}
}
@media (max-height:840px) and (min-height:501px){
  .tt-btns{position:sticky;bottom:0;z-index:4;padding:4px 0 2px;
    background:linear-gradient(180deg,rgba(246,242,255,0),#F6F2FF 14px);}
}
@media (prefers-reduced-motion:reduce){
  .tt-btn:active,.tt-open:active,.tt-goback:active{transform:none;}
}
`;

// ---------------------------------------------------------------------------
// 舞台:Canvas 四列 + 判定线
// ---------------------------------------------------------------------------

/**
 * 一次命中碎出几颗小音符:完美多一点、良好少一点;
 * 开了「减少动效」就只留很少几颗,但仍旧看得见命中反馈(不是瞬删)。
 */
export function particleCount(reduced: boolean, strong: boolean): number {
  if (reduced) return strong ? 3 : 2;
  return strong ? 10 : 6;
}

/** 小音符飘多久淡完(毫秒) */
export const PARTICLE_LIFE_MS = 620;
/** 减少动效时飘得短一些 */
export const PARTICLE_LIFE_REDUCED_MS = 320;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  /** 预渲染的小星星 / 小音符 / 判定小字贴图 */
  sprite: CanvasImageSource;
  w: number;
  h: number;
}

/** 命中处的判定等级爆点:金色六芒星 / 白色四芒星 + 扩散圆环 */
interface Burst {
  lane: number;
  grade: BurstGrade;
  at: number;
}

/** 双人分轨的分侧统计(纯视觉记账,结算面板两列对比用) */
export interface SideTally {
  perfect: number;
  good: number;
  miss: number;
  score: number;
}

export interface StageDone {
  state: RunState;
  /** 对战时假人的分数;没有假人就是 0 */
  rivalScore: number;
  /** 双人分轨时左右两侧各自的统计;单人是 null */
  sides: [SideTally, SideTally] | null;
}

export interface StageOpts {
  chart: Chart;
  rules: RunRules;
  /** 顶上那一行说明 */
  banner: string;
  /** 开场提示语(显示在判定线下面那行,省一行顶部高度) */
  hint?: string;
  /** 双人分轨:左两轨给朵朵、右两轨给星星 */
  split?: boolean;
  /** 舞台主题(STAGE_THEMES 的下标,按章节查表;纯视觉) */
  theme?: number;
  /** 对战对手 */
  rival?: AiTier | null;
  sfx: (name: SoundName) => void;
  tones: ToneKit;
  onDone: (r: StageDone) => void;
}

export function createStage(host: HTMLElement, opts: StageOpts): { destroy: () => void } {
  const split = opts.split === true;
  const state = createRun(opts.chart, opts.rules);
  const rivalScore = opts.rival ? aiRun(opts.chart, opts.rival, opts.chart.seed + 5).score : 0;
  const approach = approachMs(opts.chart.speed);

  let destroyed = false;
  let paused = false;
  let over = false;
  let raf = 0;
  let startWall = 0;
  let pauseWall = 0;
  let pausedTotal = 0;
  let lastFrame = 0;
  const particles: Particle[] = [];
  const bursts: Burst[] = [];
  /** 最近一次连击 +1 的时刻,连击数字按它弹跳一下 */
  let comboPopAt = -9999;
  /** 每条轨最近一次命中 / miss 的时刻,用来画底部亮起与温柔的变暗 */
  const laneHit = new Array<number>(LANE_COUNT).fill(-9999);
  const laneDim = new Array<number>(LANE_COUNT).fill(-9999);
  const held = new Set<number>();
  const pressedKeys = new Set<string>();
  const theme = STAGE_THEMES[opts.theme ?? 0] ?? STAGE_THEMES[0];
  /** 双人分轨才记两侧统计,结算面板两列对比用 */
  const sideTally: [SideTally, SideTally] | null = split
    ? [
        { perfect: 0, good: 0, miss: 0, score: 0 },
        { perfect: 0, good: 0, miss: 0, score: 0 },
      ]
    : null;

  const wrap = document.createElement("div");
  wrap.className = "tt-wrap";
  const style = document.createElement("style");
  style.textContent = CSS;
  const banner = document.createElement("div");
  banner.className = "tt-banner";
  banner.innerHTML = opts.banner;
  const hud = document.createElement("div");
  hud.className = "tt-hud";
  const stats = document.createElement("div");
  stats.className = "tt-stats";
  hud.appendChild(stats);
  const canvas = document.createElement("canvas");
  canvas.className = "tt-canvas";
  const say = document.createElement("div");
  say.className = "tt-say";
  say.setAttribute("role", "status");
  say.setAttribute("aria-live", "polite");
  const keys = document.createElement("div");
  keys.className = "tt-keys";
  wrap.append(style, banner, hud, canvas, say, keys);
  host.appendChild(wrap);

  let width = stageWidth(viewportWidth());
  let height = stageHeight(width, viewportHeightPx());
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    `四条轨道的下落谱面,判定线在下方,一共 ${opts.chart.notes.length} 个音符`
  );

  const ctx2d = (canvas.getContext("2d") ?? null) as CanvasRenderingContext2D | null;

  // 暂停按钮挤进计分那一行:矮屏上单独占一行的话判定线就被推出舞台了
  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "tt-btn tt-btn-pause";
  pauseBtn.innerHTML = pauseIconSVG();
  pauseBtn.setAttribute("aria-label", "暂停");
  pauseBtn.addEventListener("click", () => togglePause());
  hud.appendChild(pauseBtn);

  keys.innerHTML = split
    ? "朵朵 A S 管左两轨(S 也可以按 D) · 星星 K L 管右两轨(也可以按 ← →) · Esc 暂停"
    : "键盘 D F J K 对四条轨 · 也能直接点 · Esc 暂停";

  let judgeRatio = JUDGE_LINE_RATIO;

  function judgeY(): number {
    return Math.round(height * judgeRatio);
  }

  function nowMs(): number {
    const p = (globalThis as { performance?: { now: () => number } }).performance;
    const wall = p ? p.now() : 0;
    if (startWall === 0) startWall = wall;
    if (paused) return pauseWall - startWall - pausedTotal;
    return wall - startWall - pausedTotal;
  }

  function renderHud(): void {
    const lives = Number.isFinite(state.rules.maxMiss)
      ? `<span class="tt-stat tt-stat-life" aria-label="还能漏 ${Math.max(0, state.rules.maxMiss - state.miss)} 个">💗 ${Math.max(0, state.rules.maxMiss - state.miss)}</span>`
      : "";
    const rival = opts.rival
      ? `<span class="tt-stat">🤖 ${TIER_NAMES[opts.rival]} ${rivalScore} 分</span>`
      : "";
    stats.innerHTML = `<span class="tt-stat">🎼 ${state.score} 分</span>
      <span class="tt-stat tt-stat-combo">🔥 ${state.combo} 连</span>${lives}${rival}`;
  }

  function tell(text: string, missish = false): void {
    say.className = `tt-say${missish ? " tt-say-miss" : ""}`;
    say.textContent = text;
  }

  // -------------------------------------------------------------------------
  // 命中反馈:碎成往上飘的小星星与小音符,禁止瞬删
  // -------------------------------------------------------------------------

  function spawnParticles(lane: number, grade: BurstGrade, strong: boolean): void {
    const n = particleCount(reduceMotion(), strong);
    const cx = (lane + 0.5) * (width / LANE_COUNT);
    const cy = judgeY();
    for (let i = 0; i < n; i++) {
      const size = 13 + Math.random() * 8;
      particles.push({
        x: cx + (Math.random() - 0.5) * (width / LANE_COUNT) * 0.7,
        y: cy,
        vx: (Math.random() - 0.5) * 0.06,
        vy: -(0.08 + Math.random() * 0.1),
        life: 0,
        max: reduceMotion() ? PARTICLE_LIFE_REDUCED_MS : PARTICLE_LIFE_MS,
        sprite: sparkSprite(i % 3 === 0 ? "note" : "star", grade),
        w: size,
        h: size,
      });
    }
  }

  /** 完美命中多一枚「完美」小字往上飘(预渲染贴图,不逐帧写字) */
  function spawnGradeLabel(lane: number): void {
    particles.push({
      x: (lane + 0.5) * (width / LANE_COUNT),
      y: judgeY() - 30,
      vx: 0,
      vy: -0.045,
      life: 0,
      max: reduceMotion() ? PARTICLE_LIFE_REDUCED_MS : PARTICLE_LIFE_MS,
      sprite: gradeLabelSprite("perfect"),
      w: 64,
      h: 24,
    });
  }

  /** 双人分轨记一笔:左两轨算朵朵,右两轨算星星 */
  function tallySide(ev: RunEvent): void {
    if (!sideTally) return;
    const side = sideTally[ev.lane < LANE_COUNT / 2 ? 0 : 1];
    if (ev.kind === "perfect") side.perfect++;
    else if (ev.kind === "good") side.good++;
    else if (ev.kind === "miss") side.miss++;
    side.score += ev.gain;
  }

  function handleEvents(): void {
    if (state.events.length === 0) return;
    for (const ev of state.events as RunEvent[]) {
      tallySide(ev);
      if (ev.kind === "perfect" || ev.kind === "good") {
        const perfect = ev.kind === "perfect";
        laneHit[ev.lane] = state.timeMs;
        bursts.push({ lane: ev.lane, grade: ev.kind, at: state.timeMs });
        comboPopAt = state.timeMs;
        spawnParticles(ev.lane, ev.kind, perfect);
        if (perfect) spawnGradeLabel(ev.lane);
        opts.tones.hit(ev.kind, ev.lane, state.combo);
        if (state.combo > 0 && state.combo % 10 === 0) opts.sfx("coin");
        tell(perfect ? `完美!${state.combo} 连` : `良好 · ${state.combo} 连`);
      } else if (ev.kind === "hold") {
        held.add(ev.lane);
        opts.tones.holdStart(ev.lane, state.combo);
        tell("按住别松,亮到尾端再抬手。");
      } else if (ev.kind === "miss") {
        laneDim[ev.lane] = state.timeMs;
        opts.tones.miss();
        tell(MISS_LINE, true);
      } else {
        laneDim[ev.lane] = state.timeMs;
        opts.tones.miss();
        tell(state.message, true);
      }
    }
    state.events.length = 0;
    renderHud();
  }

  // -------------------------------------------------------------------------
  // 输入
  // -------------------------------------------------------------------------

  function pressLane(lane: number): void {
    if (over || paused || destroyed || lane < 0) return;
    // 这一关没启用的轨上什么都没有,点下去自然按「点空白」算,规则不打折
    tapLane(state, lane, nowMs());
    handleEvents();
    checkOver();
  }

  function liftLane(lane: number): void {
    if (over || paused || destroyed || lane < 0) return;
    held.delete(lane);
    releaseLane(state, lane, nowMs());
    handleEvents();
    checkOver();
  }

  function onKeyDown(ev: KeyboardEvent): void {
    if (destroyed) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      togglePause();
      return;
    }
    const key = (ev.key ?? "").toLowerCase();
    const lane = laneForKey(key, split);
    if (lane < 0) return;
    ev.preventDefault();
    if (pressedKeys.has(key)) return;
    // 一条轨的两个键当一个键使:S 按着的时候再按 D,不算又点了一次
    const already = laneHeldByKey(lane);
    pressedKeys.add(key);
    if (already) return;
    pressLane(lane);
  }

  /** 这条轨上还有键按着吗(别名键让一条轨可能对两个键) */
  function laneHeldByKey(lane: number): boolean {
    for (const k of pressedKeys) if (laneForKey(k, split) === lane) return true;
    return false;
  }

  function onKeyUp(ev: KeyboardEvent): void {
    if (destroyed) return;
    const key = (ev.key ?? "").toLowerCase();
    const lane = laneForKey(key, split);
    if (lane < 0) return;
    pressedKeys.delete(key);
    // 还有别的键按着同一条轨就不算抬手,不然长条按到一半换个手指会被判成提前松开
    if (laneHeldByKey(lane)) return;
    liftLane(lane);
  }

  function pointerLane(ev: { clientX?: number }): number {
    const rect = canvas.getBoundingClientRect?.();
    const left = rect ? rect.left : 0;
    const shown = rect && rect.width > 0 ? rect.width : width;
    const x = ((ev.clientX ?? 0) - left) * (width / shown);
    return laneForX(x, width);
  }

  function onPointerDown(ev: PointerEvent): void {
    if (destroyed) return;
    ev.preventDefault?.();
    pressLane(pointerLane(ev));
  }

  function onPointerUp(ev: PointerEvent): void {
    if (destroyed) return;
    liftLane(pointerLane(ev));
  }

  // -------------------------------------------------------------------------
  // 暂停与收尾
  // -------------------------------------------------------------------------

  function togglePause(): void {
    if (over || destroyed) return;
    const p = (globalThis as { performance?: { now: () => number } }).performance;
    const wall = p ? p.now() : 0;
    paused = !paused;
    if (paused) {
      pauseWall = wall;
      pauseBtn.innerHTML = `${playIconSVG()}<span> 继续</span>`;
      showCover(
        `${pauseIconSVG(17)}<span> 先歇一会儿</span>`,
        "谱面停在这里等你,回来接着弹。",
        `${playIconSVG()}<span> 继续玩</span>`,
        () => togglePause()
      );
    } else {
      pausedTotal += wall - pauseWall;
      pauseBtn.innerHTML = `${pauseIconSVG()}<span> 暂停</span>`;
      hideCover();
    }
    opts.sfx("tap");
  }

  function showCover(title: string, sub: string, label: string, onClick: () => void): void {
    hideCover();
    const cover = document.createElement("div");
    cover.className = "tt-cover";
    cover.innerHTML = `<div class="tt-cover-t">${title}</div><div class="tt-cover-s">${sub}</div>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tt-btn tt-btn-go";
    // 标题与按钮文案都可能带内联 SVG 小图标(暂停/继续),所以走 innerHTML
    btn.innerHTML = label;
    btn.addEventListener("click", onClick);
    cover.appendChild(btn);
    wrap.appendChild(cover);
  }

  function hideCover(): void {
    wrap.querySelector(".tt-cover")?.remove();
  }

  function checkOver(): void {
    if (over || !state.over) return;
    over = true;
    renderHud();
    opts.sfx(state.cleared ? "win" : "oops");
    if (!state.cleared) tell(state.ended === "empty" ? state.message : MISS_LINE, true);
    opts.onDone({ state, rivalScore, sides: sideTally });
  }

  // -------------------------------------------------------------------------
  // 绘制:静态背景预渲染一张,每帧 drawImage 拼装 + 动态层
  // -------------------------------------------------------------------------

  /** 轨道渐变、分隔线微光、列首符号都是静态的,resize 时重画一张离屏图 */
  let bgLayer: HTMLCanvasElement | null = null;

  function buildBackground(): void {
    const cv = document.createElement("canvas");
    cv.width = width;
    cv.height = height;
    bgLayer = cv;
    const c = (cv.getContext("2d") ?? null) as CanvasRenderingContext2D | null;
    if (!c) return;
    const lane = width / LANE_COUNT;
    const line = judgeY();
    for (let i = 0; i < LANE_COUNT; i++) {
      const on = opts.chart.lanes.includes(i);
      const base = on ? LANE_SOFT[i] : LANE_OFF;
      // 极淡纵向渐变:顶暗底亮,视线被引向判定线
      const g = c.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, shadeHex(base, -0.05));
      g.addColorStop(Math.max(0.05, Math.min(0.95, line / height)), shadeHex(base, 0.5));
      g.addColorStop(1, base);
      c.fillStyle = g;
      c.fillRect(i * lane, 0, lane, height);
      // 分隔线加微光
      c.fillStyle = rgbaOf(theme.glow, 0.08);
      c.fillRect(i * lane - 1.5, 0, 3, height);
      c.fillStyle = "rgba(150,135,190,.2)";
      c.fillRect(i * lane - 0.5, 0, 1, height);
      // 列首小符号(圆/菱/三角/星):除颜色外多一条形状通道
      c.fillStyle = on ? rgbaOf(LANE_COLORS[i], 0.55) : "rgba(160,150,180,.25)";
      traceLaneSymbol(c, i, i * lane + lane / 2, 16, 7);
      c.fill();
    }
  }

  /**
   * 上半屏主题饰层(visual-r1 · B 档 TOP10 之 8):5 枚列首同款符号极淡上飘,
   * 补齐「音游基准 3 层背景」缺的主题饰层。只在判定线上方 60% 区间活动、
   * globalAlpha 0.07,不遮判定线不抢音符;reduced 时静止定格。
   */
  function drawDriftSymbols(c: CanvasRenderingContext2D, t: number): void {
    const reduced = reduceMotion();
    const line = judgeY();
    const top = 30;
    const span = Math.max(60, line * 0.6 - top);
    for (let k = 0; k < 5; k++) {
      const fx = (0.5 + k * 0.83) % 1; // 黄金比错开,不成排
      const phase = reduced ? k / 5 : (t / (14000 + k * 1600) + k / 5) % 1;
      const y = top + span * (1 - phase);
      const x = width * (0.08 + fx * 0.84);
      c.save();
      c.globalAlpha = 0.07;
      c.fillStyle = LANE_COLORS[k % LANE_COUNT];
      traceLaneSymbol(c, k % LANE_COUNT, x, y, 6 + (k % 3) * 2);
      c.fill();
      c.restore();
    }
  }

  /** 舞台灯:2–3 道极淡斜向光束,随曲目进度缓慢摆动;reduced 静止,连击 ≥ 20 转暖 */
  function drawBeams(c: CanvasRenderingContext2D, t: number): void {
    const reduced = reduceMotion();
    const tint = rgbaOf(beamTint(theme, state.combo), 0.1);
    for (let i = 0; i < BEAM_COUNT; i++) {
      const rad = (beamAngle(t, i, reduced) * Math.PI) / 180;
      c.save();
      c.translate(width * (0.22 + 0.28 * i), -8);
      c.rotate(rad);
      c.fillStyle = tint;
      c.fillRect(-width * 0.07, 0, width * 0.14, height * 1.5);
      c.restore();
    }
  }

  function draw(t: number): void {
    const c = ctx2d;
    if (!c) return;
    const lane = width / LANE_COUNT;
    const line = judgeY();
    const pxPerMs = line / approach;

    c.clearRect(0, 0, width, height);
    // 静态背景(轨道渐变 + 分隔线 + 列首符号)一次 drawImage
    if (bgLayer) c.drawImage(bgLayer, 0, 0);
    drawBeams(c, t);
    drawDriftSymbols(c, t);
    for (let i = 0; i < LANE_COUNT; i++) {
      const dim = t - laneDim[i];
      if (dim >= 0 && dim < 700) {
        // miss 的温柔提示:轨道整体轻微变暗,不闪红
        c.fillStyle = `rgba(120,108,150,${0.16 * (1 - dim / 700)})`;
        c.fillRect(i * lane, 0, lane, height);
      }
    }

    // 音符:预渲染 sprite 拼装(尺寸与位置公式不动 = 判定手感不动)
    for (const ns of state.notes) {
      if (ns.status === "done" || ns.status === "missed") continue;
      const note = ns.note;
      const headY = line - (note.time - t) * pxPerMs;
      const tailY = line - (note.time + note.hold - t) * pxPerMs;
      if (headY < -80 || tailY > height + 80) continue;
      const x = note.lane * lane + lane * 0.14;
      const w = lane * 0.72;
      if (note.hold > 0) {
        const top = Math.min(headY, tailY);
        const h = Math.max(18, Math.abs(headY - tailY));
        // 条身:半透明渐变管 + 两侧 1px 亮边
        const body = c.createLinearGradient(0, top, 0, top + h);
        body.addColorStop(0, rgbaOf(LANE_COLORS[note.lane], 0.28));
        body.addColorStop(1, rgbaOf(LANE_COLORS[note.lane], 0.45));
        c.fillStyle = body;
        tracePill(c, x + w * 0.16, top, w * 0.68, h, w * 0.28);
        c.fill();
        c.strokeStyle = rgbaOf(shadeHex(LANE_COLORS[note.lane], 0.45), 0.9);
        c.lineWidth = 1;
        tracePill(c, x + w * 0.16, top, w * 0.68, h, w * 0.28);
        c.stroke();
        if (ns.status === "holding") {
          // holding:条身外发光一圈
          c.strokeStyle = "rgba(255,255,255,.8)";
          c.lineWidth = 2;
          tracePill(c, x + w * 0.16 - 1.5, top - 1.5, w * 0.68 + 3, h + 3, w * 0.28);
          c.stroke();
          // 星光流:流动亮带 + 两颗小星随流;reduced 关流光,亮带定在底部不动
          const reduced = reduceMotion();
          const flow = reduced ? Math.min(22, h) : (t / 6) % Math.max(1, h);
          c.fillStyle = "rgba(255,255,255,.35)";
          tracePill(c, x + w * 0.28, top + h - flow, w * 0.44, Math.min(22, h), w * 0.18);
          c.fill();
          if (!reduced) {
            c.fillStyle = "rgba(255,255,255,.85)";
            traceStar(c, x + w * 0.5, top + Math.max(4, h - flow + 6), 5, 2.2, 5);
            c.fill();
            traceStar(c, x + w * 0.36, top + Math.max(4, ((h - flow + h * 0.66) % h) + 4), 3.5, 1.6, 5);
            c.fill();
          }
        }
        // 头部:星光琴键(长按款,带「按住」提示环)
        c.drawImage(noteSprite(note.lane, "hold"), x, headY - 13, w, 26);
      } else {
        c.drawImage(noteSprite(note.lane, "tap"), x, headY - 13, w, 26);
      }
    }

    // 命中时轨道底部亮一下(留旧口径)
    let lastHitAt = -9999;
    for (let i = 0; i < LANE_COUNT; i++) {
      lastHitAt = Math.max(lastHitAt, laneHit[i]);
      const since = t - laneHit[i];
      if (since >= 0 && since < 320) {
        const a = 1 - since / 320;
        c.fillStyle = `rgba(255,220,150,${0.5 * a})`;
        c.fillRect(i * lane, line - 26, lane, height - line + 26);
      }
    }
    // 判定线:命中后 0.1s 整线增亮 + 两端小星星端点
    const flash = t - lastHitAt >= 0 && t - lastHitAt < 100;
    c.fillStyle = flash ? shadeHex("#8A6AD6", 0.35) : "#8A6AD6";
    c.fillRect(0, line - 2, width, 4);
    c.fillStyle = rgbaOf("#8A6AD6", flash ? 0.4 : 0.22);
    c.fillRect(0, line - 9, width, 7);
    c.fillStyle = "#FFD76A";
    traceStar(c, 9, line, 7, 3, 5);
    c.fill();
    traceStar(c, width - 9, line, 7, 3, 5);
    c.fill();

    // 判定等级爆点:扩散圆环(列色)+ 完美金色六芒星 / 良好白色四芒星
    for (const b of bursts) {
      const age = t - b.at;
      if (age < 0 || age >= RING_MS) continue;
      const k = age / RING_MS;
      const cx = (b.lane + 0.5) * lane;
      c.globalAlpha = 1 - k;
      c.strokeStyle = LANE_COLORS[b.lane];
      c.lineWidth = 3 * (1 - k) + 1;
      c.beginPath();
      c.arc(cx, line, 10 + k * lane * 0.55, 0, Math.PI * 2);
      c.stroke();
      const s = (b.grade === "perfect" ? 58 : 44) * (0.6 + 0.6 * k);
      c.drawImage(burstSprite(b.grade), cx - s / 2, line - s / 2, s, s);
    }
    c.globalAlpha = 1;

    // 命中粒子:预渲染的小星星 / 小音符往上飘着淡出(不再逐帧写字)
    for (const p of particles) {
      const a = Math.max(0, 1 - p.life / p.max);
      c.globalAlpha = a;
      const grow = 0.75 + 0.45 * a;
      c.drawImage(p.sprite, p.x - (p.w * grow) / 2, p.y - (p.h * grow) / 2, p.w * grow, p.h * grow);
    }
    c.globalAlpha = 1;

    // 连击上屏:≥ 5 连在判定线上方亮大号数字,每 +1 弹跳一下(reduced 静态)
    if (state.combo >= COMBO_SHOW_MIN) {
      const pop = comboScale(t - comboPopAt, reduceMotion());
      c.save();
      c.translate(width / 2, line - 48);
      c.scale(pop, pop);
      c.font = '900 30px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.lineWidth = 6;
      c.strokeStyle = "rgba(255,255,255,.9)";
      c.strokeText(`${state.combo} 连`, 0, 0);
      c.fillStyle = state.combo >= WARM_COMBO ? "#E8912D" : theme.glow;
      c.fillText(`${state.combo} 连`, 0, 0);
      c.restore();
    }

    // 预备倒数:3-2-1 节拍圆点,和第一个音符的落线时刻对齐(纯视觉)
    const lead = state.chart.notes[0]?.time ?? 0;
    const remain = countdownStep(t, lead);
    if (remain > 0) {
      for (let i = 0; i < 3; i++) {
        const on = i < remain;
        const pulse = !on || reduceMotion() ? 1 : 1 + 0.08 * Math.sin(t / 130);
        c.fillStyle = on ? theme.glow : rgbaOf(theme.glow, 0.22);
        c.beginPath();
        c.arc(width / 2 + (i - 1) * 34, height * 0.36, 8 * pulse, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  function step(dt: number, t: number): void {
    for (const p of particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life >= particles[i].max) particles.splice(i, 1);
    }
    // 爆点比粒子先谢幕(250ms < 620ms),这里顺手清掉过期的
    for (let i = bursts.length - 1; i >= 0; i--) {
      if (t - bursts[i].at >= RING_MS) bursts.splice(i, 1);
    }
    draw(t);
  }

  function frame(): void {
    if (destroyed) return;
    const t = nowMs();
    const dt = Math.max(0, Math.min(64, t - lastFrame));
    lastFrame = t;
    if (!paused && !over) {
      advanceTo(state, t);
      handleEvents();
      checkOver();
    }
    if (destroyed) return;
    step(dt, t);
    // 这一段弹完、粒子也飘干净了就把循环停下来,不在后台空转
    if (destroyed || (over && particles.length === 0)) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  /** 判定线底下还得放得进提示行和键位行,这些是量出来的 */
  function roomBelowCanvas(): number {
    const below = (say.offsetHeight ?? 0) + (keys.offsetHeight ?? 0);
    return (below > 0 ? below : 44) + 22;
  }

  /**
   * 画布真正能占的宽:量 wrap 的内容宽。视口宽减 24 在平台壳层里会超出
   * (壳层四周还有 60px 左右的白边),画布左右各被裁十几像素,最边上的
   * 轨道就点不着了;量不到(测试桩/还没上屏)退回视口口径。
   */
  function hostWidthPx(): number {
    const cw = wrap.clientWidth;
    if (typeof cw !== "number" || cw <= 0) return viewportWidth();
    try {
      const s = getComputedStyle(wrap);
      const pad = (parseFloat(s.paddingLeft) || 0) + (parseFloat(s.paddingRight) || 0);
      return Math.max(0, cw - pad) + 24;
    } catch {
      return cw + 24;
    }
  }

  /** 按舞台真实剩余空间收一次画布,保证判定线留在能点到的地方 */
  function resize(): void {
    width = stageWidth(Math.min(viewportWidth(), hostWidthPx()));
    const roomy = stageHeight(width, viewportHeightPx());
    const top = canvas.getBoundingClientRect?.()?.top ?? 0;
    const bottom = clipBottomPx(wrap);
    height = fitStageHeight(roomy, bottom > 0 && top > 0 ? bottom - top - roomBelowCanvas() : 0);
    // N-90:MIN_STAGE_PX 兜底后画布底仍可能被剪,把判定线收进看得见的那段
    judgeRatio = top > 0 ? fitJudgeRatio(height, top, bottom) : JUDGE_LINE_RATIO;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    buildBackground();
  }

  const onResize = (): void => {
    if (destroyed) return;
    resize();
  };

  canvas.addEventListener("pointerdown", onPointerDown as EventListener);
  canvas.addEventListener("pointerup", onPointerUp as EventListener);
  canvas.addEventListener("pointercancel", onPointerUp as EventListener);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onResize);

  renderHud();
  tell(opts.hint ?? (opts.rival ? tierLine(opts.rival) : "音符压到判定线就点,空白格别碰。"));
  resize();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.removeEventListener("pointerdown", onPointerDown as EventListener);
      canvas.removeEventListener("pointerup", onPointerUp as EventListener);
      canvas.removeEventListener("pointercancel", onPointerUp as EventListener);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      particles.length = 0;
      bursts.length = 0;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 闯关:188 关
// ---------------------------------------------------------------------------

function playLevelWith(tones: ToneKit, modeBar: HTMLElement) {
  return function playLevel(host: HTMLElement, ctx: PlayCtx): PlayHandle {
    const lv = buildLevel(ctx.level);
    const chart = levelChart(lv);
    const ch = CHAPTERS[lv.chapter];
    let stage: { destroy: () => void } | null = null;
    // 关内把模式入口收起来:矮屏上这一排要占掉两行,判定线就被挤出首屏了
    modeBar.hidden = true;

    stage = createStage(host, {
      chart,
      rules: levelRules(lv),
      // 关号和章节名平台的关卡条上已经写着了,这儿不重复占一行
      banner: "",
      hint: `${ch.emoji} ${levelBrief(lv)} · ${lv.hint}`,
      split: lv.split,
      theme: themeForChapter(lv.chapter),
      sfx: ctx.sfx,
      tones,
      onDone: ({ state }) => {
        if (state.cleared) {
          const stars = levelStars(state);
          ctx.win(stars, winLine(stars, state.maxCombo));
        } else {
          ctx.lose(loseLine(state.ended));
        }
      },
    });

    return {
      destroy() {
        stage?.destroy();
        stage = null;
        modeBar.hidden = false;
      },
    };
  };
}

// ---------------------------------------------------------------------------
// 模式外壳
// ---------------------------------------------------------------------------

interface ModeShell {
  wrap: HTMLElement;
  chip: HTMLElement;
  stage: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void): ModeShell {
  const wrap = document.createElement("div");
  wrap.className = "tt-mode";
  const style = document.createElement("style");
  style.textContent = CSS;
  const head = document.createElement("div");
  head.className = "tt-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "tt-goback";
  back.textContent = "◀ 回选关";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = document.createElement("span");
  chip.className = "tt-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(style, head, stage);
  host.appendChild(wrap);
  return { wrap, chip, stage, destroy: () => wrap.remove() };
}

function overPanel(
  host: HTMLElement,
  title: string,
  sub: string,
  label: string,
  onAgain: () => void,
  detail?: HTMLElement | null
): void {
  host.innerHTML = "";
  const box = document.createElement("div");
  box.className = "tt-over";
  box.innerHTML = `<div class="tt-over-t">${title}</div><div class="tt-over-s">${sub}</div>`;
  if (detail) box.appendChild(detail);
  const again = document.createElement("button");
  again.type = "button";
  again.className = "tt-open";
  again.textContent = label;
  again.addEventListener("click", onAgain);
  box.appendChild(again);
  host.appendChild(box);
}

/**
 * 结算的判定统计:完美 / 良好 / 溜走三色横条 + 最高连击徽章 + 星级;
 * 双人分轨再补两列对比。全是给孩子看的复盘,不改任何分数。
 */
function judgeSummary(state: RunState, sides?: [SideTally, SideTally] | null): HTMLElement {
  const total = Math.max(1, state.perfect + state.good + state.miss);
  const box = document.createElement("div");
  box.className = "tt-sum";

  const bar = document.createElement("div");
  bar.className = "tt-sum-bar";
  bar.setAttribute("aria-hidden", "true");
  const segs: Array<[string, number]> = [
    ["tt-seg-p", state.perfect],
    ["tt-seg-g", state.good],
    ["tt-seg-m", state.miss],
  ];
  for (const [cls, n] of segs) {
    const seg = document.createElement("span");
    seg.className = cls;
    seg.style.width = `${Math.round((n / total) * 100)}%`;
    bar.appendChild(seg);
  }

  const legend = document.createElement("div");
  legend.className = "tt-sum-legend";
  legend.textContent = `完美 ${state.perfect} · 良好 ${state.good} · 溜走 ${state.miss}`;

  const badges = document.createElement("div");
  badges.className = "tt-sum-badges";
  const comboBadge = document.createElement("span");
  comboBadge.className = "tt-badge";
  comboBadge.textContent = `最高 ${state.maxCombo} 连`;
  const stars = levelStars(state);
  const starBadge = document.createElement("span");
  starBadge.className = "tt-badge tt-badge-star";
  starBadge.setAttribute("aria-label", `${stars} 星`);
  starBadge.textContent = `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`;
  badges.append(comboBadge, starBadge);
  box.append(bar, legend, badges);

  if (sides) {
    const cols = document.createElement("div");
    cols.className = "tt-duo-cols";
    const names = ["🌸 朵朵(左两轨)", "⭐ 星星(右两轨)"];
    sides.forEach((side, i) => {
      const col = document.createElement("div");
      col.className = "tt-duo-col";
      col.innerHTML = `<div>${names[i]}</div>
        <div>完美 ${side.perfect} · 良好 ${side.good}</div>
        <div>溜走 ${side.miss} · 得分 ${side.score}</div>`;
      cols.appendChild(col);
    });
    box.appendChild(cols);
  }
  return box;
}

// ---------------------------------------------------------------------------
// 无尽:速度一路往上加,0 容错
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, tones: ToneKit, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack);
  let wave = 0;
  let total = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  let stage: { destroy: () => void } | null = null;

  function startWave(): void {
    stage?.destroy();
    shell.stage.innerHTML = "";
    const chart = endlessWave(wave);
    shell.chip.textContent = `♾️ 第 ${wave + 1} 段 · 速度 ${endlessSpeedAt(wave * 8000).toFixed(2)} · 累计 ${total} 分 · 最好 ${best}`;
    stage = createStage(shell.stage, {
      chart,
      rules: ENDLESS_RULES,
      banner: `♾️ 无尽加速 · 第 ${wave + 1} 段<br>一个音符都不能漏,速度会一直往上加`,
      theme: 0,
      sfx: (n) => api.play(n),
      tones,
      onDone: ({ state }) => {
        total += state.score;
        if (state.cleared) {
          wave++;
          api.addStars(1);
          startWave();
          return;
        }
        best = save.recordEndlessBest(meta.id, total);
        overPanel(
          shell.stage,
          state.ended === "empty" ? "点到空白格啦" : "有个音符溜走啦",
          `撑到了第 ${wave + 1} 段,一共 ${total} 分,最好成绩 ${best} 分。再来一次一定能更远!`,
          "🔁 从第 1 段再来",
          () => {
            api.play("tap");
            wave = 0;
            total = 0;
            startWave();
          },
          judgeSummary(state)
        );
      },
    });
  }

  startWave();
  return {
    destroy() {
      stage?.destroy();
      stage = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 对战:同一张谱,和假人比分
// ---------------------------------------------------------------------------

function mountVersus(host: HTMLElement, api: GameApi, tones: ToneKit, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack);
  let tier: AiTier = "normal";
  let round = 1;
  const wins = [0, 0];
  /** 同分是平局:高档假人一下不差,孩子打满分也只能追平,这一格不能算在谁头上 */
  let draws = 0;
  let stage: { destroy: () => void } | null = null;

  function scoreLine(): string {
    const drawPart = draws > 0 ? ` · 平 ${draws}` : "";
    return `你 ${wins[0]} : ${wins[1]} ${TIER_NAMES[tier]}${drawPart}`;
  }

  function pickPanel(): void {
    stage?.destroy();
    stage = null;
    shell.chip.textContent = "⚔️ 对战 · 挑一个对手";
    shell.stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "tt-over";
    box.innerHTML = `<div class="tt-over-t">⚔️ 同一张谱,比谁分高</div>
      <div class="tt-over-s">对手会照着同一张谱弹,档位越高手越准。</div>`;
    const row = document.createElement("div");
    row.className = "tt-btns";
    for (const t of ["rookie", "normal", "expert", "hell"] as AiTier[]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `tt-btn${tier === t ? " tt-btn-go" : ""}`;
      b.textContent = TIER_NAMES[t];
      b.addEventListener("click", () => {
        api.play("tap");
        tier = t;
        pickPanel();
      });
      row.appendChild(b);
    }
    const go = document.createElement("button");
    go.type = "button";
    go.className = "tt-open tt-open-vs";
    go.textContent = "开始 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      startRound();
    });
    box.append(row, go);
    shell.stage.appendChild(box);
  }

  function startRound(): void {
    stage?.destroy();
    shell.stage.innerHTML = "";
    shell.chip.textContent = `⚔️ 第 ${round} 局 · ${scoreLine()}`;
    stage = createStage(shell.stage, {
      chart: matchChart(round),
      rules: { emptyRule: "combo", maxMiss: CAMPAIGN_MAX_MISS },
      banner: `⚔️ 第 ${round} 局 · 对手「${TIER_NAMES[tier]}」<br>同一张谱,分高的那个赢`,
      theme: 1,
      rival: tier,
      sfx: (n) => api.play(n),
      tones,
      onDone: ({ state, rivalScore }) => {
        // 赢仍旧是严格大于;分一样多就是平局,记在自己那一格里,不许说成「对手分高」
        if (state.score > rivalScore) {
          wins[0]++;
          api.addStars(1);
        } else if (state.score < rivalScore) {
          wins[1]++;
        } else {
          draws++;
          api.addStars(1);
        }
        const title =
          state.score > rivalScore
            ? "🏆 你赢下这一局!"
            : state.score < rivalScore
              ? "🤖 这局对手分高一点"
              : "🤝 打成平手!";
        const tail =
          state.score > rivalScore
            ? "手感正好,趁热再来一局。"
            : state.score < rivalScore
              ? "再稳一点连击就追回来了。"
              : "一分不差地追平了,再来一局看谁先多出一个连击。";
        overPanel(
          shell.stage,
          title,
          `你 ${state.score} 分 · 对手 ${rivalScore} 分。最高 ${state.maxCombo} 连,${tail}`,
          "🔁 再来一局",
          () => {
            api.play("tap");
            round++;
            startRound();
          },
          judgeSummary(state)
        );
      },
    });
  }

  pickPanel();
  return {
    destroy() {
      stage?.destroy();
      stage = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人同屏:朵朵管左两轨,星星管右两轨,合作打同一张谱
// ---------------------------------------------------------------------------

function mountTwoPlayer(host: HTMLElement, api: GameApi, tones: ToneKit, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack);
  let round = 1;
  let bestTogether = 0;
  let stage: { destroy: () => void } | null = null;

  function startRound(): void {
    stage?.destroy();
    shell.stage.innerHTML = "";
    shell.chip.textContent = `👫 第 ${round} 局 · 两人最好 ${bestTogether} 分`;
    stage = createStage(shell.stage, {
      chart: matchChart(round + 40),
      rules: { emptyRule: "combo", maxMiss: 5 },
      banner:
        "👫 一张谱两个人打<br>朵朵管左边两轨(A / S,S 也可以用 D),星星管右边两轨(K / L,也可以用 ← / →)",
      split: true,
      theme: 2,
      sfx: (n) => api.play(n),
      tones,
      onDone: ({ state, sides }) => {
        bestTogether = Math.max(bestTogether, state.score);
        api.addStars(1);
        overPanel(
          shell.stage,
          state.cleared ? "🎉 两个人一起弹完啦!" : "这一段先到这儿",
          `合力 ${state.score} 分,最高 ${state.maxCombo} 连,漏了 ${state.miss} 个。配合越熟,连击越长。`,
          "🔁 再来一局",
          () => {
            api.play("tap");
            round++;
            startRound();
          },
          judgeSummary(state, sides)
        );
      },
    });
  }

  startRound();
  return {
    destroy() {
      stage?.destroy();
      stage = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const tones = createToneKit();
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "tt-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "tt-open";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "tt-open tt-open-vs";
  vsBtn.textContent = "⚔️ 同谱对战";
  const duoBtn = document.createElement("button");
  duoBtn.type = "button";
  duoBtn.className = "tt-open tt-open-duo";
  // 章节页签里也有「双人分轨」四个字,模式入口用「双人同屏」区分开
  duoBtn.textContent = "👫 双人同屏";
  bar.append(endlessBtn, vsBtn, duoBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽加速 · 最好 ${best} 分` : "♾️ 无尽加速 · 点我开始!";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(
    make: (host: HTMLElement, api: GameApi, tones: ToneKit, back: () => void) => { destroy: () => void }
  ): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, tones, closeMode);
  }

  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  vsBtn.addEventListener("click", () => openMode(mountVersus));
  duoBtn.addEventListener("click", () => openMode(mountTwoPlayer));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel: playLevelWith(tones, bar),
      mapHint: "音符压到判定线就点,空白格千万别碰;长按条要按住到尾。",
      grandMessage: "188 关全部弹完,四条轨都成了你的琴键!",
      guide: guideBook,
      guideTitle: "音符下落 · 手感手记",
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      tones.close();
      root.remove();
    },
  };
}
