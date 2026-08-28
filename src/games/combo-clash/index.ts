import { meta } from "./meta";
export { meta };

// 连招对决:跳过去接一串连招,再取消成超必杀。
// 188 关挑战塔 + 四档人机 BO3 + 连胜无尽 + 同屏双人 + 训练场,对手是本机 AI,全程离线。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import {
  ARCHETYPE_LABELS,
  CHARACTERS,
  METER_MAX,
  SLOT_LABELS,
  SUPER_LV1_COST,
  SUPER_LV2_COST,
  characterById,
  type MoveSlot
} from "./frames";
import {
  DUMMY_LABELS,
  DUMMY_MODES,
  WAKEUP_LABELS,
  inputOf,
  neutralInput,
  sparkCount,
  superCutinFrames,
  totalFrames,
  type DummyMode,
  type InputFrame
} from "./rules";
import {
  characterOf,
  createMatch,
  currentMove,
  stepMatch,
  type FighterState,
  type MatchConfig,
  type MatchState,
  type SideStats
} from "./engine";
import { AI_TIERS, AI_TIER_HINTS, AI_TIER_LABELS, dummyDecider, foeDecider, type AiTier } from "./ai";
import {
  CHAPTERS,
  endlessConfig,
  endlessMatchConfig,
  goalLine,
  levelConfig,
  levelWon,
  matchConfigFor,
  starsFor,
  trainingMatchConfig,
  versusMatchConfig,
  type LevelResult
} from "./levels";
import {
  CONFETTI_COUNT,
  HIT_FLASH_FRAMES,
  HIT_SPARK_RAYS,
  KO_FRAMES,
  drawArcSlash,
  drawComboPop,
  drawConfettiPiece,
  drawGuardShard,
  drawHitSpark,
  drawKoBanner,
  drawMiniAvatar,
  drawMiniStar,
  drawProjectileOrb,
  drawQFighter,
  drawSeatAura,
  drawStage,
  drawWinBadges,
  koBannerText,
  makeConfetti,
  makeShatter,
  poseOf,
  stageThemeOf,
  type ConfettiPiece,
  type Shard,
  type StageThemeId,
  type StrikeAim
} from "./art";

/** 舞台画布高度 */
export const STAGE_HEIGHT = 250;
/** 地面在画布里的 y */
export const GROUND_Y = 214;

/** 画布显示高压到这以下,人物比按钮还小,打不成了 */
export const MIN_CANVAS_DISPLAY_PX = 140;

/**
 * 画布显示高的钳位:塞得下返回 null(别动),塞不下返回该钳到的像素(不低于 min)。
 *
 * 为什么要钳:HUD(双方血条/能量/护盾)两行 + 提示行 + 摇杆按钮排加起来 ~200px,
 * 画布又是按宽度等比长高的 —— 640×360 横屏里 `.game-stage` 只给 ~340px,
 * 画布 250px 显示高一占,摇杆和「轻/重/必杀」整排掉到裁切线以下;
 * 触屏没键盘,按钮看不见 = 这局没法打。钳高后画布等比收窄(CSS 只设 max-height,
 * 宽由 aspect-ratio 跟着缩),战场变小但整场都在屏里。
 */
export function canvasDisplayCapPx(nativeH: number, roomPx: number, min = MIN_CANVAS_DISPLAY_PX): number | null {
  if (!Number.isFinite(nativeH) || nativeH <= 0) return null;
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  const cap = Math.floor(roomPx);
  // 差一个像素以内不算超:亚像素抖动不值得为它改样式
  if (nativeH <= cap + 1) return null;
  return Math.max(min, cap);
}

const CSS = `
.cc-wrap{font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(180deg,#FFF2F8,#F5F0FF);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;}
.cc-hud{display:flex;gap:8px;align-items:stretch;margin-bottom:6px;}
.cc-side{flex:1 1 0;min-width:0;}
.cc-side.cc-right{text-align:right;}
.cc-topline{display:flex;align-items:center;gap:5px;min-height:26px;}
.cc-right .cc-topline{flex-direction:row-reverse;}
.cc-ava{width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.75);flex:0 0 auto;}
.cc-stars{width:56px;height:18px;flex:0 0 auto;}
.cc-name{font-size:16px;font-weight:900;color:#8a4a76;overflow-wrap:anywhere;line-height:1.4;min-width:0;}
.cc-bar{height:12px;border-radius:8px;background:#F0E4EE;overflow:hidden;margin-top:3px;}
.cc-bar>i{display:block;height:100%;border-radius:8px;transition:width .12s linear;}
.cc-bar.cc-thin{height:7px;}
.cc-vigor>i{background:linear-gradient(90deg,#FF9EC4,#F26FA4);}
.cc-meter>i{background:linear-gradient(90deg,#FFD98A,#F5B93C);}
.cc-meter.cc-full>i{background:linear-gradient(90deg,#FFD98A,#FFF3C9,#F5B93C,#FFD98A);background-size:200% 100%;
  animation:ccflow 1.1s linear infinite;}
@keyframes ccflow{from{background-position:0 0;}to{background-position:200% 0;}}
.cc-guard>i{background:linear-gradient(90deg,#A9D8F5,#5FA9DE);}
.cc-mid{flex:0 0 auto;text-align:center;min-width:86px;}
.cc-timer{font-size:22px;font-weight:900;color:#7a4a86;line-height:1.1;}
.cc-dots{font-size:var(--mt-control,14px);letter-spacing:2px;color:#D8A8C4;}
.cc-dots b{color:#E0568F;}
.cc-combo{font-size:16px;font-weight:800;color:#8a5aa8;min-height:18px;overflow-wrap:anywhere;}
.cc-canvas{width:100%;height:auto;display:block;border-radius:14px;background:#FFF7FC;touch-action:none;}
.cc-msg{text-align:center;min-height:20px;color:#7a4a86;font-weight:800;margin-top:6px;font-size:16px;
  overflow-wrap:anywhere;line-height:1.5;}
.cc-pad{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-top:8px;flex-wrap:wrap;}
.cc-stick{width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.6);position:relative;
  box-shadow:inset 0 0 0 3px rgba(200,160,200,.35);flex:0 0 auto;touch-action:none;}
.cc-stick>i{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
  background:rgba(232,150,190,.75);}
.cc-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.cc-btn{min-width:64px;min-height:64px;border:none;border-radius:50%;font-family:inherit;font-size:16px;
  font-weight:900;cursor:pointer;background:#FFD3E6;color:#8a3a66;box-shadow:0 4px 0 #E7A9C6;touch-action:none;}
.cc-btn.cc-heavy{background:#FFE3B8;color:#8a6321;box-shadow:0 4px 0 #E7C68A;}
.cc-btn.cc-burst{background:#D9D2FB;color:#4f3f96;box-shadow:0 4px 0 #B4A8E8;}
.cc-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #E7A9C6;}
.cc-btn:focus-visible,.cc-open:focus-visible,.cc-back:focus-visible{outline:3px solid #46246b;outline-offset:3px;}
.cc-modebar,.cc-optbar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.cc-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#7a4a86;text-align:center;overflow-wrap:anywhere;}
.cc-open{border:none;border-radius:999px;padding:10px 18px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  min-height:44px;font-family:inherit;background:linear-gradient(180deg,#E27BAE,#C55A91);box-shadow:0 4px 0 #A44576;}
.cc-open:active{transform:translateY(2px);box-shadow:0 2px 0 #A44576;}
.cc-open.cc-ghost{background:linear-gradient(180deg,#8f8fd0,#6f6fb4);box-shadow:0 4px 0 #5a5a97;}
.cc-mode{max-width:860px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",sans-serif;}
.cc-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.cc-back{border:none;border-radius:999px;padding:8px 14px;font-size:14px;font-weight:900;cursor:pointer;
  min-height:44px;font-family:inherit;background:#ffffffd9;color:#a4548a;box-shadow:0 3px 0 rgba(180,120,160,.35);}
.cc-badge{background:#fff;border-radius:14px;padding:6px 10px;font-weight:800;font-size:16px;color:#8a4a76;
  box-shadow:0 2px 6px rgba(190,150,190,.3);overflow-wrap:anywhere;}
.cc-pick{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:8px;}
.cc-face{min-width:74px;min-height:74px;border:none;border-radius:16px;font-family:inherit;cursor:pointer;
  background:#fff;box-shadow:0 3px 8px rgba(190,150,190,.3);padding:6px 4px;display:flex;flex-direction:column;
  align-items:center;gap:2px;}
.cc-face.cc-on{outline:3px solid #E0568F;}
.cc-face em{font-style:normal;font-size:22px;line-height:1;}
.cc-face span{font-size:var(--mt-control,14px);font-weight:900;color:#7a4a86;}
.cc-face i{font-style:normal;font-size:var(--mt-control,14px);color:#9a7ba8;}
.cc-note{text-align:center;font-size:16px;font-weight:700;color:#8a6a9a;line-height:1.6;overflow-wrap:anywhere;
  margin:6px auto;max-width:520px;}
.cc-over{text-align:center;padding:22px 16px;background:#fff;border-radius:18px;box-shadow:0 4px 14px rgba(190,150,190,.3);}
.cc-over-t{font-size:21px;font-weight:900;color:#8a4a76;margin-bottom:8px;}
.cc-over-s{font-size:16px;font-weight:700;color:#7a5a8a;line-height:1.6;margin-bottom:14px;overflow-wrap:anywhere;}
.cc-train{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px;}
.cc-info{background:#ffffffd0;border-radius:12px;padding:8px 10px;font-size:16px;font-weight:700;color:#6a4a7a;
  line-height:1.6;overflow-wrap:anywhere;max-width:520px;margin:8px auto 0;text-align:left;}
.cc-info b{color:#a4548a;}
@media (max-width:360px){
  .cc-timer{font-size:19px;}
  .cc-stick{width:96px;height:96px;}
  .cc-btn{min-width:56px;min-height:56px;font-size:15px;}
  .cc-open{padding:9px 13px;font-size:14px;}
  .cc-face{min-width:64px;}
  .cc-stars{width:44px;}
}
@media (prefers-reduced-motion:reduce){
  .cc-bar>i{transition:none;}
  .cc-meter.cc-full>i{animation:none;}
}
`;

function reducedMotion(): boolean {
  try {
    return Boolean(
      (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      )?.matches
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 键位:朵朵 WASD + F/G,星星 方向键 + L/K
// ---------------------------------------------------------------------------

type Dir = "left" | "right" | "up" | "down" | "light" | "heavy";

/** 朵朵这一侧的键位 */
export function duoKey(k: string): Dir | null {
  if (k === "a") return "left";
  if (k === "d") return "right";
  if (k === "w") return "up";
  if (k === "s") return "down";
  if (k === "f") return "light";
  if (k === "g") return "heavy";
  return null;
}

/** 星星这一侧的键位 */
export function starKey(k: string): Dir | null {
  if (k === "ArrowLeft") return "left";
  if (k === "ArrowRight") return "right";
  if (k === "ArrowUp") return "up";
  if (k === "ArrowDown") return "down";
  if (k === "l") return "light";
  if (k === "k") return "heavy";
  return null;
}

interface HeldKeys {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  light: boolean;
  heavy: boolean;
  burst: boolean;
}

function emptyHeld(): HeldKeys {
  return { left: false, right: false, up: false, down: false, light: false, heavy: false, burst: false };
}

/** 键位状态 → 引擎输入:轻重同按也算必杀钮 */
export function heldToInput(h: HeldKeys): InputFrame {
  return inputOf({
    left: h.left,
    right: h.right,
    up: h.up,
    down: h.down,
    light: h.light,
    heavy: h.heavy,
    burst: h.burst || (h.light && h.heavy)
  });
}

// ---------------------------------------------------------------------------
// 舞台绘制:资产都在 ./art,这里只管把对局状态翻译成绘制参数
// ---------------------------------------------------------------------------

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

/** 命中放射火花(0.15s 一枚) */
interface HitBurst {
  x: number;
  y: number;
  age: number;
  power: number;
}

/** 连击 ≥ 3 的角落弹窗 */
interface ComboPop {
  side: 0 | 1;
  n: number;
  age: number;
}

/**
 * 命中特效的粒子预算:soft(减弱动效)一律 0,正常给 6–8 根放射线 +
 * `sparkCount` 颗星屑。纯查表,视觉契约测试直接断言。
 */
export function fxBudget(soft: boolean, power: number): { rays: number; stars: number } {
  if (soft) return { rays: 0, stars: 0 };
  return { rays: HIT_SPARK_RAYS, stars: sparkCount(power, false) };
}

/** `?debug` 才把判定框描出来(以前是把 hitbox 当动画,现在只留调试口) */
function debugBoxes(): boolean {
  try {
    const loc = (globalThis as { location?: { search?: string } }).location;
    return typeof loc?.search === "string" && /[?&]debug/.test(loc.search);
  } catch {
    return false;
  }
}

/** 把出招翻译成绘制目标:哪条肢体、伸到判定框中心哪个点(只读 box,不改 box) */
function strikeAimOf(mv: { kind: string; box: { x: number; y: number; w: number; h: number } }): StrikeAim {
  return {
    dx: mv.box.x + mv.box.w * 0.5,
    dy: mv.box.y + mv.box.h * 0.5,
    limb: mv.kind === "heavy" ? "leg" : mv.kind === "light" ? "arm" : "both"
  };
}

// ---------------------------------------------------------------------------
// 一场对局(战役 / 对战 / 双人 / 无尽 / 训练都用它)
// ---------------------------------------------------------------------------

export type SeatKind = { kind: "duo" } | { kind: "star" } | { kind: "ai"; tier: AiTier; style?: "normal" | "turtle" | "jumper"; seed: number } | { kind: "dummy"; mode: DummyMode };

export interface ArenaOpts {
  cfg: MatchConfig;
  seats: [SeatKind, SeatKind];
  goalText?: string;
  training?: boolean;
  /** 舞台主题(闯关按 levels 章节查表,其它模式各给一个默认) */
  theme?: StageThemeId;
  sfx: (n: "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump") => void;
  onEnd?: (m: MatchState) => void;
}

export interface Arena {
  destroy: () => void;
  state: () => MatchState;
}

/** 一侧 HUD 的持久节点(每帧只改数值,不重建 DOM,画布头像才留得住) */
interface SideUi {
  ava: HTMLCanvasElement;
  name: HTMLElement;
  stars: HTMLCanvasElement;
  vigorBar: HTMLElement;
  vigorFill: HTMLElement;
  meterBar: HTMLElement;
  meterFill: HTMLElement;
  guardBar: HTMLElement;
  guardFill: HTMLElement;
  lastChar: string;
  lastStars: number;
}

function buildSide(box: HTMLElement): SideUi {
  const top = document.createElement("div");
  top.className = "cc-topline";
  const ava = document.createElement("canvas");
  ava.className = "cc-ava";
  ava.width = 24;
  ava.height = 24;
  ava.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "cc-name";
  const stars = document.createElement("canvas");
  stars.className = "cc-stars";
  stars.width = 56;
  stars.height = 18;
  stars.setAttribute("role", "img");
  top.append(ava, name, stars);
  const mkBar = (cls: string, thin: boolean): [HTMLElement, HTMLElement] => {
    const bar = document.createElement("div");
    bar.className = `cc-bar${thin ? " cc-thin" : ""} ${cls}`;
    bar.setAttribute("role", "img");
    const fill = document.createElement("i");
    bar.appendChild(fill);
    return [bar, fill];
  };
  const [vigorBar, vigorFill] = mkBar("cc-vigor", false);
  const [meterBar, meterFill] = mkBar("cc-meter", true);
  const [guardBar, guardFill] = mkBar("cc-guard", true);
  box.append(top, vigorBar, meterBar, guardBar);
  return { ava, name, stars, vigorBar, vigorFill, meterBar, meterFill, guardBar, guardFill, lastChar: "", lastStars: -1 };
}

export function createArena(host: HTMLElement, opts: ArenaOpts): Arena {
  const soft = reducedMotion();
  const cfg = { ...opts.cfg, reducedMotion: soft };
  const theme = opts.theme ?? "sakura";
  const dbg = debugBoxes();
  let m = createMatch(cfg);
  const sparks: Spark[] = [];
  const bursts: HitBurst[] = [];
  const shards: Shard[] = [];
  const confetti: ConfettiPiece[] = [];
  let comboPop: ComboPop | null = null;
  const lastCombo: [number, number] = [0, 0];
  /** 投技拉近的剩余演出帧 */
  let grab = 0;
  /** KO 演出:-1 = 还没 KO,>=0 = 倒计时 */
  let koLeft = -1;
  /** 渲染帧计数(动画相位;对局暂停时呼吸和花瓣也继续飘) */
  let anim = 0;
  let dummyMode: DummyMode = opts.seats[1].kind === "dummy" ? opts.seats[1].mode : "stand";

  const wrap = document.createElement("div");
  wrap.className = "cc-wrap";

  const hud = document.createElement("div");
  hud.className = "cc-hud";
  const left = document.createElement("div");
  left.className = "cc-side";
  const mid = document.createElement("div");
  mid.className = "cc-mid";
  const right = document.createElement("div");
  right.className = "cc-side cc-right";
  hud.append(left, mid, right);
  const uiL = buildSide(left);
  const uiR = buildSide(right);

  function updateSide(ui: SideUi, f: FighterState): void {
    const ch = characterOf(f);
    if (ui.lastChar !== f.charId) {
      ui.lastChar = f.charId;
      ui.name.textContent = `${ch.emoji} ${ch.name}`;
      const g = ui.ava.getContext("2d");
      if (g) {
        g.clearRect(0, 0, ui.ava.width, ui.ava.height);
        drawMiniAvatar(g, { size: ui.ava.width, color: ch.color, ink: ch.ink, look: ch.look });
      }
    }
    const vig = Math.max(0, Math.round((f.vigor / f.vigorMax) * 100));
    const met = Math.round((f.meter / METER_MAX) * 100);
    const gua = Math.round((f.guard / f.guardMax) * 100);
    ui.vigorFill.style.width = `${vig}%`;
    ui.vigorBar.setAttribute("aria-label", `元气 ${vig}%`);
    ui.meterFill.style.width = `${met}%`;
    ui.meterBar.setAttribute("aria-label", `能量 ${met}%`);
    ui.meterBar.classList.toggle("cc-full", f.meter >= METER_MAX);
    ui.guardFill.style.width = `${gua}%`;
    ui.guardBar.setAttribute("aria-label", `护盾 ${gua}%`);
    const starsLit = Math.max(0, Math.ceil((f.vigor / f.vigorMax) * 3));
    if (starsLit !== ui.lastStars) {
      ui.lastStars = starsLit;
      ui.stars.setAttribute("aria-label", `元气星 ${starsLit} / 3`);
      const g = ui.stars.getContext("2d");
      if (g) {
        g.clearRect(0, 0, ui.stars.width, ui.stars.height);
        drawWinBadges(g, { n: starsLit, total: 3, w: ui.stars.width, h: ui.stars.height });
      }
    }
  }

  const canvas = document.createElement("canvas");
  canvas.className = "cc-canvas";
  canvas.width = cfg.stageWidth;
  canvas.height = STAGE_HEIGHT;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "连招对决的舞台");
  const ctx = canvas.getContext("2d");

  /** 一个盒子的下沿(测试桩的 rect 可能没有 bottom,用 top+height 兜底) */
  const rectBottom = (r: { top: number; bottom?: number; height: number }): number =>
    Number.isFinite(r.bottom) ? (r.bottom as number) : r.top + r.height;

  /** 往上找平台舞台(game-stage 类,定高会裁内容)的下沿;量不到返回 NaN */
  function stageClipBottom(): number {
    let node: HTMLElement | null = wrap.parentElement ?? null;
    for (let i = 0; node && i < 10; i++) {
      if (typeof node.className === "string" && node.className.includes("game-stage")) {
        if (typeof node.getBoundingClientRect !== "function") break;
        const r = node.getBoundingClientRect();
        const inner =
          typeof node.clientHeight === "number" && node.clientHeight > 0
            ? (node.clientTop || 0) + node.clientHeight
            : r.height;
        if (Number.isFinite(r.top) && Number.isFinite(inner) && inner > 0) return r.top + inner;
        break;
      }
      node = node.parentElement ?? null;
    }
    return Number.NaN;
  }

  /** 画布显示高按可视余量钳一刀(见 canvasDisplayCapPx 的注释) */
  function fitDisplay(): void {
    if (destroyed || !canvas.style) return;
    if (typeof canvas.getBoundingClientRect !== "function" || typeof wrap.getBoundingClientRect !== "function") return;
    const clip = stageClipBottom();
    if (!Number.isFinite(clip)) return;
    // 先摘掉上一次的钳位再量:量到的必须是「本来要多高」
    canvas.style.maxHeight = "";
    canvas.style.maxWidth = "";
    const canvasRect = canvas.getBoundingClientRect();
    if (!Number.isFinite(canvasRect.top)) return;
    // 画布下面的家当(提示行 + 摇杆按钮排):高度不随画布显示高变,量一次就是稳的
    const below = Math.max(0, rectBottom(wrap.getBoundingClientRect()) - rectBottom(canvasRect));
    const px = canvasDisplayCapPx(canvasRect.height, clip - canvasRect.top - below - 4);
    if (px !== null) {
      // CSS 里画布是 width:100%,只钳高会压扁人物;宽也按 backing 比例一起钳才是等比
      canvas.style.maxHeight = `${px}px`;
      canvas.style.maxWidth = `${Math.round((px * canvas.width) / canvas.height)}px`;
      // 等比收窄后画布居中,别贴在左边
      canvas.style.marginLeft = "auto";
      canvas.style.marginRight = "auto";
    }
  }

  const msg = document.createElement("div");
  msg.className = "cc-msg";
  msg.textContent = opts.goalText ?? "";

  const pad = document.createElement("div");
  pad.className = "cc-pad";
  const stick = document.createElement("div");
  stick.className = "cc-stick";
  stick.setAttribute("role", "application");
  stick.setAttribute("aria-label", "虚拟摇杆:按住往哪边推就往哪边走,往上推是跳");
  const knob = document.createElement("i");
  stick.appendChild(knob);
  const btns = document.createElement("div");
  btns.className = "cc-btns";
  const bLight = document.createElement("button");
  bLight.type = "button";
  bLight.className = "cc-btn";
  bLight.textContent = "轻";
  const bHeavy = document.createElement("button");
  bHeavy.type = "button";
  bHeavy.className = "cc-btn cc-heavy";
  bHeavy.textContent = "重";
  const bBurst = document.createElement("button");
  bBurst.type = "button";
  bBurst.className = "cc-btn cc-burst";
  bBurst.textContent = "必杀";
  btns.append(bLight, bHeavy, bBurst);
  pad.append(stick, btns);

  const info = document.createElement("div");
  info.className = "cc-info";
  info.hidden = !opts.training;

  wrap.append(hud, canvas, msg, pad, info);
  host.appendChild(wrap);

  // --- 输入 ---
  const held: [HeldKeys, HeldKeys] = [emptyHeld(), emptyHeld()];
  const touch = emptyHeld();
  let paused = false;

  const seatOf = (kind: "duo" | "star"): 0 | 1 | null => {
    if (opts.seats[0].kind === kind) return 0;
    if (opts.seats[1].kind === kind) return 1;
    return null;
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      paused = !paused;
      msg.textContent = paused ? "⏸️ 暂停中,再按 Esc 继续。" : opts.goalText ?? "继续!";
      // 这一下归自己了:不拦住,游戏壳还会再弹一次统一暂停面板,
      // 之后的 Esc 只关面板,场上却一直停着
      e.preventDefault();
      return;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const duoSeat = seatOf("duo");
    const starSeat = seatOf("star");
    const d = duoKey(k);
    if (d !== null && duoSeat !== null) {
      held[duoSeat][d] = true;
      if (k === "a" || k === "d" || k === "w" || k === "s") e.preventDefault();
    }
    const s = starKey(k);
    if (s !== null && starSeat !== null) {
      held[starSeat][s] = true;
      if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown") e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const duoSeat = seatOf("duo");
    const starSeat = seatOf("star");
    const d = duoKey(k);
    if (d !== null && duoSeat !== null) held[duoSeat][d] = false;
    const s = starKey(k);
    if (s !== null && starSeat !== null) held[starSeat][s] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const offs: Array<() => void> = [];
  function bindHold(el: HTMLElement, key: keyof HeldKeys): void {
    const on = (e: PointerEvent): void => {
      e.preventDefault();
      touch[key] = true;
    };
    const off = (): void => {
      touch[key] = false;
    };
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointercancel", off);
    el.addEventListener("pointerleave", off);
    offs.push(() => {
      el.removeEventListener("pointerdown", on);
      el.removeEventListener("pointerup", off);
      el.removeEventListener("pointercancel", off);
      el.removeEventListener("pointerleave", off);
    });
  }
  bindHold(bLight, "light");
  bindHold(bHeavy, "heavy");
  bindHold(bBurst, "burst");

  let stickId = -1;
  const stickMove = (e: PointerEvent): void => {
    const r = stick.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const th = r.width * 0.18;
    touch.left = dx < -th;
    touch.right = dx > th;
    touch.up = dy < -th;
    touch.down = dy > th;
    knob.style.transform = `translate(${Math.max(-30, Math.min(30, dx))}px,${Math.max(-30, Math.min(30, dy))}px)`;
  };
  const stickDown = (e: PointerEvent): void => {
    e.preventDefault();
    stickId = e.pointerId;
    stickMove(e);
  };
  const stickDrag = (e: PointerEvent): void => {
    if (e.pointerId !== stickId) return;
    stickMove(e);
  };
  const stickUp = (): void => {
    stickId = -1;
    touch.left = touch.right = touch.up = touch.down = false;
    knob.style.transform = "";
  };
  stick.addEventListener("pointerdown", stickDown);
  stick.addEventListener("pointermove", stickDrag);
  stick.addEventListener("pointerup", stickUp);
  stick.addEventListener("pointercancel", stickUp);
  offs.push(() => {
    stick.removeEventListener("pointerdown", stickDown);
    stick.removeEventListener("pointermove", stickDrag);
    stick.removeEventListener("pointerup", stickUp);
    stick.removeEventListener("pointercancel", stickUp);
  });

  // --- 决策器 ---
  const deciders: Array<((m: MatchState, side: 0 | 1) => InputFrame) | null> = [null, null];
  opts.seats.forEach((seat, i) => {
    if (seat.kind === "ai") deciders[i] = foeDecider(seat.style ?? "normal", seat.tier, seat.seed);
    else if (seat.kind === "dummy") deciders[i] = dummyDecider(seat.mode, 21);
  });

  function inputFor(side: 0 | 1): InputFrame {
    const seat = opts.seats[side];
    if (seat.kind === "ai") return deciders[side]?.(m, side) ?? neutralInput();
    if (seat.kind === "dummy") {
      const d = dummyDecider(dummyMode, 21 + m.frame);
      return d(m, side);
    }
    const h = held[side];
    const merged: HeldKeys = seat.kind === "duo" && opts.seats[1].kind !== "star"
      ? {
          left: h.left || touch.left,
          right: h.right || touch.right,
          up: h.up || touch.up,
          down: h.down || touch.down,
          light: h.light || touch.light,
          heavy: h.heavy || touch.heavy,
          burst: h.burst || touch.burst
        }
      : h;
    return heldToInput(merged);
  }

  // --- 声音与命中特效 ---
  let lastSfx = 0;
  function playEvents(): void {
    for (const ev of m.events) {
      const now = m.frame;
      if (now - lastSfx < 4) continue;
      lastSfx = now;
      if (ev.kind === "hit") opts.sfx("pop");
      else if (ev.kind === "block") opts.sfx("tap");
      else if (ev.kind === "crush") opts.sfx("oops");
      else if (ev.kind === "throw") opts.sfx("coin");
      else if (ev.kind === "super") opts.sfx("coin");
      else if (ev.kind === "clash") opts.sfx("tap");
      else if (ev.kind === "knockdown") opts.sfx("meow");
    }
    for (const ev of m.events) {
      // 投技拉近:抓住的那一下,双方画面拉近拖拽 3 帧(只挪画面不挪判定)
      if (ev.kind === "throw") grab = 3;
      const budget = fxBudget(soft, ev.power);
      if (ev.kind === "crush" && budget.rays > 0) shards.push(...makeShatter(ev.x, GROUND_Y - ev.y));
      if ((ev.kind === "hit" || ev.kind === "throw" || ev.kind === "clash") && budget.rays > 0) {
        bursts.push({ x: ev.x, y: GROUND_Y - ev.y, age: 0, power: ev.power });
        for (let i = 0; i < budget.stars; i++) {
          sparks.push({
            x: ev.x,
            y: GROUND_Y - ev.y,
            vx: (i - budget.stars / 2) * 0.5,
            vy: -1 - (i % 3),
            life: 16 + (i % 5),
            color: i % 2 === 0 ? "#FFD05A" : "#FF9EC4"
          });
        }
      }
    }
    // 连击 ≥ 3:角落弹出连击数字
    for (const side of [0, 1] as const) {
      const c = m.fighters[side].comboHits;
      if (c >= 3 && c > lastCombo[side]) comboPop = { side, n: c, age: 0 };
      lastCombo[side] = c;
    }
  }

  // --- 渲染 ---

  /** 画一位格斗家:光环 → 分层 Q 版 → 攻击弧光 → (调试)判定框 */
  function drawOne(f: FighterState, side: 0 | 1, drawX: number): void {
    if (!ctx) return;
    const ch = characterOf(f);
    const mv = currentMove(f);
    const fr = f.frame - 1;
    let seg: "startup" | "active" | "recovery" | null = null;
    let prog = 0;
    if (mv) {
      if (fr < mv.startup) {
        seg = "startup";
        prog = fr / Math.max(1, mv.startup);
      } else if (fr < mv.startup + mv.active) {
        seg = "active";
        prog = (fr - mv.startup) / Math.max(1, mv.active);
      } else {
        seg = "recovery";
        prog = (fr - mv.startup - mv.active) / Math.max(1, mv.recovery);
      }
    }
    const pose = poseOf({
      phase: f.phase,
      stance: f.stance,
      moveKind: mv?.kind ?? null,
      seg,
      prog,
      tick: anim + side * 37,
      won: m.winner === f.side
    });
    drawSeatAura(ctx, { x: drawX, groundY: GROUND_Y, side, t: anim / 60, soft });
    drawQFighter(ctx, {
      x: drawX,
      feet: GROUND_Y - f.y,
      groundY: GROUND_Y,
      facing: f.facing,
      color: ch.color,
      ink: ch.ink,
      look: ch.look,
      halfWidth: ch.halfWidth,
      height: ch.height,
      crouchHeight: ch.crouchHeight,
      pose,
      strike: mv && pose.strike > 0 ? strikeAimOf(mv) : null,
      t: anim / 60
    });
    // 攻击弧光:命中帧亮起,收招头两帧留残光(投射招的光在弹丸上)
    if (mv && !mv.projectile && fr >= mv.startup && fr < mv.startup + mv.active + 2) {
      const k = Math.min(1, Math.max(0, (fr - mv.startup) / Math.max(1, mv.active + 1)));
      drawArcSlash(ctx, {
        x: drawX + f.facing * (mv.box.x + mv.box.w / 2),
        y: GROUND_Y - f.y - mv.box.y - mv.box.h / 2,
        facing: f.facing,
        size: Math.max(mv.box.w, mv.box.h) * 0.62,
        k,
        kind: mv.kind,
        color: ch.color,
        soft
      });
    }
    if (dbg && mv && fr >= mv.startup && fr < mv.startup + mv.active) {
      const rx = f.facing === 1 ? f.x + mv.box.x : f.x - mv.box.x - mv.box.w;
      ctx.strokeStyle = "rgba(255,60,90,.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, GROUND_Y - f.y - mv.box.y - mv.box.h, mv.box.w, mv.box.h);
    }
  }

  function render(): void {
    if (!ctx) return;
    anim += 1;
    const [a, b] = m.fighters;
    updateSide(uiL, a);
    updateSide(uiR, b);
    const secs = Math.ceil(m.timer / 60);
    const dots = (side: 0 | 1): string => {
      let s = "";
      for (let i = 0; i < cfg.roundsToWin; i++) s += m.wins[side] > i ? "<b>●</b>" : "○";
      return s;
    };
    const combo = Math.max(a.comboHits, b.comboHits);
    mid.innerHTML = `<div class="cc-timer">${Math.max(0, secs)}</div>
      <div class="cc-dots">${dots(0)} · ${dots(1)}</div>
      <div class="cc-combo">${combo >= 2 ? `${combo} 连!` : `第 ${m.round} 回合`}</div>`;

    // 震屏:命中顿帧的小抖 + KO 的 0.3s 缩放震屏(soft 全关)
    let sx = !soft && m.hitstop > 0 ? (m.hitstop % 2 === 0 ? 2 : -2) : 0;
    let sy = 0;
    let sc = 1;
    if (!soft && koLeft > 0) {
      const k = koLeft / KO_FRAMES;
      sx += Math.sin(koLeft * 1.7) * 3 * k;
      sy = Math.cos(koLeft * 2.3) * 2 * k;
      sc = 1 + 0.03 * k;
    }
    ctx.setTransform(sc, 0, 0, sc, sx - ((sc - 1) * cfg.stageWidth) / 2, sy - ((sc - 1) * STAGE_HEIGHT) / 2);

    drawStage(ctx, {
      w: cfg.stageWidth,
      h: STAGE_HEIGHT,
      groundY: GROUND_Y,
      shift: (a.x + b.x) / 2,
      theme,
      t: anim / 60,
      soft
    });

    for (const p of m.projectiles) {
      drawProjectileOrb(ctx, {
        cx: p.x + p.w / 2,
        cy: GROUND_Y - p.y - p.h / 2,
        r: Math.min(p.w, p.h) / 2 + 3,
        color: p.color,
        t: anim / 60,
        facing: p.vx >= 0 ? 1 : -1
      });
    }

    // 投技拉近:抓住的 3 帧里双方朝对方各挪 3px(只挪画面)
    const pull = grab > 0 ? 3 : 0;
    const dirAB = b.x >= a.x ? 1 : -1;
    drawOne(a, 0, a.x + pull * dirAB);
    drawOne(b, 1, b.x - pull * dirAB);

    // 星屑(画的小星形,不再是 ✦ 字符)
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.18;
      s.life -= 1;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      drawMiniStar(ctx, s.x, s.y, 2.6 + (s.life % 3), s.color);
    }
    // 命中放射火花 + 闪白(0.15s)
    for (let i = bursts.length - 1; i >= 0; i--) {
      const bu = bursts[i];
      bu.age += 1;
      if (bu.age > HIT_FLASH_FRAMES) {
        bursts.splice(i, 1);
        continue;
      }
      drawHitSpark(ctx, { x: bu.x, y: bu.y, k: bu.age / HIT_FLASH_FRAMES, power: bu.power });
    }
    // 破防盾碎片
    for (let i = shards.length - 1; i >= 0; i--) {
      const s = shards[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.16;
      s.rot += s.vr;
      s.life -= 1;
      if (s.life <= 0) {
        shards.splice(i, 1);
        continue;
      }
      drawGuardShard(ctx, s);
    }
    // KO 彩带
    for (let i = confetti.length - 1; i >= 0; i--) {
      const p = confetti[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.rot += p.vr;
      p.life -= 1;
      if (p.life <= 0) {
        confetti.splice(i, 1);
        continue;
      }
      drawConfettiPiece(ctx, p);
    }
    // 连击数字弹窗
    if (comboPop) {
      comboPop.age += 1;
      const gone = comboPop.age > 48 || m.fighters[comboPop.side].comboHits === 0;
      if (gone) comboPop = null;
      else {
        drawComboPop(ctx, {
          x: comboPop.side === 0 ? 56 : cfg.stageWidth - 56,
          y: 44,
          n: comboPop.n,
          age: comboPop.age,
          soft
        });
      }
    }
    // KO 横幅(分级红线:文案只用「获胜」)
    if (koLeft >= 0 && m.winner !== null) {
      const name = m.winner === -1 ? null : characterOf(m.fighters[m.winner]).name;
      drawKoBanner(ctx, { w: cfg.stageWidth, text: koBannerText(name), t: anim / 60 });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (opts.training) renderTraining();
  }

  function renderTraining(): void {
    const f = m.fighters[0];
    const mv = currentMove(f);
    const frameLine = mv
      ? `<b>${mv.name}</b>(${SLOT_LABELS[mv.slot]}) 起手 ${mv.startup} / 命中 ${mv.active} / 收招 ${mv.recovery} · 取消窗口 ${mv.cancelLag} 帧 · 现在第 ${f.frame} 帧`
      : "站着的时候这里会显示上一招的帧数;出一招试试。";
    info.innerHTML = `<div>${frameLine}</div>
      <div>输入历史:${f.history.slice(-10).join(" ") || "·"}</div>
      <div>连段 ${f.comboHits} 段 · 空中连 ${f.juggleHits} 段 · 能量 ${Math.round(f.meter)} · 假人:${DUMMY_LABELS[dummyMode]}</div>`;
  }

  // --- 主循环 ---
  let raf = 0;
  let acc = 0;
  let last = 0;
  let destroyed = false;
  let ended = false;

  function frame(ts: number): void {
    if (destroyed) return;
    const dt = last === 0 ? 1 / 60 : Math.min(0.08, (ts - last) / 1000);
    last = ts;
    if (!paused) {
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 4) {
        acc -= 1 / 60;
        steps += 1;
        stepMatch(m, [inputFor(0), inputFor(1)]);
        playEvents();
        if (grab > 0) grab -= 1;
        if (m.winner !== null && koLeft < 0 && !opts.training) {
          // KO 演出:0.3s 震屏 + 胜者举手 + 彩带 20 片(soft 直接结算)
          koLeft = soft ? 0 : KO_FRAMES;
          if (!soft && m.winner !== -1) {
            const winX = m.fighters[m.winner].x;
            confetti.push(...makeConfetti(winX, GROUND_Y - 130, CONFETTI_COUNT));
          }
        }
      }
      if (koLeft >= 0 && !ended) {
        if (koLeft === 0) {
          ended = true;
          opts.onEnd?.(m);
        } else {
          koLeft -= 1;
        }
      }
    }
    render();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  render();

  fitDisplay();
  // 挂载那一刻可能还没排好版;抽空补量一次(不用 rAF,免得测试桩的帧队列被挤)
  const fitTimer = window.setTimeout(fitDisplay, 0);
  window.addEventListener("resize", fitDisplay);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(fitTimer);
      window.removeEventListener("resize", fitDisplay);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      for (const off of offs) off();
      offs.length = 0;
      wrap.remove();
    },
    state: () => m,
    ...(opts.training
      ? {
          setDummy(mode: DummyMode) {
            dummyMode = mode;
          }
        }
      : {})
  } as Arena & { setDummy?: (mode: DummyMode) => void };
}

// ---------------------------------------------------------------------------
// 战役:188 关挑战塔
// ---------------------------------------------------------------------------

let chosenChar = "duoduo";

/** 从对局状态里抽出闯关要的结果 */
export function levelResultOf(m: MatchState): LevelResult {
  const me = m.fighters[0];
  return {
    won: m.winner === 0,
    stats: m.stats[0] as SideStats,
    vigorLeft: me.vigor,
    vigorMax: me.vigorMax,
    roundsWon: m.wins[0]
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = levelConfig(ctx.level, chosenChar);
  let settled = false;
  const arena = createArena(stage, {
    cfg: matchConfigFor(cfg),
    goalText: goalLine(cfg),
    theme: stageThemeOf(ctx.level),
    seats: [{ kind: "duo" }, { kind: "ai", tier: cfg.tier, style: cfg.foeStyle, seed: cfg.seed }],
    sfx: ctx.sfx,
    onEnd: (m) => {
      if (settled) return;
      settled = true;
      const r = levelResultOf(m);
      if (levelWon(cfg, r)) {
        ctx.win(starsFor(cfg, r), `打中 ${r.stats.hits} 下,最长 ${r.stats.maxCombo} 连,元气还剩 ${r.vigorLeft}!`);
      } else {
        ctx.lose("这一回合先坐下歇一歇,下次早一点起手就接得上啦!");
      }
    }
  });
  return { destroy: () => arena.destroy() };
}

// ---------------------------------------------------------------------------
// 其它四种模式
// ---------------------------------------------------------------------------

type ExtraMode = "versus" | "endless" | "duo" | "train";

const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🤝 人机对战",
  endless: "♾️ 连胜无尽",
  duo: "👫 双人同屏",
  train: "🎯 训练场"
};

function charPicker(current: string, onPick: (id: string) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "cc-pick";
  for (const c of CHARACTERS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `cc-face${c.id === current ? " cc-on" : ""}`;
    b.innerHTML = `<em>${c.emoji}</em><span>${c.name}</span><i>${ARCHETYPE_LABELS[c.archetype]}</i>`;
    b.setAttribute("aria-label", `${c.name},${ARCHETYPE_LABELS[c.archetype]},${c.style}`);
    b.addEventListener("click", () => onPick(c.id));
    row.appendChild(b);
  }
  return row;
}

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "cc-mode";
  const head = document.createElement("div");
  head.className = "cc-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "cc-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "cc-badge";
  chip.textContent = MODE_TITLE[mode];
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let arena: Arena | null = null;
  let tier: AiTier = "normal";
  let foeChar = "xingxing";
  let streak = 0;
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function clearStage(): void {
    arena?.destroy();
    arena = null;
    stage.innerHTML = "";
  }

  function showOver(title: string, sub: string, again: string, next: () => void): void {
    clearStage();
    const box = document.createElement("div");
    box.className = "cc-over";
    box.innerHTML = `<div class="cc-over-t">${title}</div><div class="cc-over-s">${sub}</div>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cc-open";
    btn.textContent = again;
    btn.addEventListener("click", () => {
      api.play("tap");
      next();
    });
    box.appendChild(btn);
    stage.appendChild(box);
  }

  function menu(): void {
    clearStage();
    stage.appendChild(
      charPicker(chosenChar, (id) => {
        chosenChar = id;
        api.play("tap");
        menu();
      })
    );
    const note = document.createElement("div");
    note.className = "cc-note";
    const me = characterById(chosenChar);
    note.textContent = `${me.emoji} ${me.name}(${ARCHETYPE_LABELS[me.archetype]}):${me.style}。键位:朵朵 WASD 移动 + F 轻 + G 重,F+G 一起按是必杀钮;星星 方向键 + L 轻 + K 重;Esc 暂停。手机用左边摇杆和右边三个大钮。`;
    stage.appendChild(note);

    if (mode === "versus") {
      const row = document.createElement("div");
      row.className = "cc-optbar";
      for (const t of AI_TIERS) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `cc-open${t === tier ? "" : " cc-ghost"}`;
        b.textContent = `${AI_TIER_LABELS[t]}`;
        b.title = AI_TIER_HINTS[t];
        b.addEventListener("click", () => {
          tier = t;
          api.play("tap");
          startVersus();
        });
        row.appendChild(b);
      }
      stage.appendChild(row);
      const hint = document.createElement("div");
      hint.className = "cc-note";
      hint.textContent = `三局两胜。${AI_TIER_LABELS[tier]}:${AI_TIER_HINTS[tier]}`;
      stage.appendChild(hint);
      return;
    }
    if (mode === "endless") {
      const row = document.createElement("div");
      row.className = "cc-optbar";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cc-open";
      b.textContent = "▶ 开始连胜";
      b.addEventListener("click", () => {
        api.play("tap");
        streak = 0;
        startEndless();
      });
      row.appendChild(b);
      stage.appendChild(row);
      const hint = document.createElement("div");
      hint.className = "cc-note";
      hint.textContent = `一场接一场,对手越打越强。最高连胜 ${best} 场。`;
      stage.appendChild(hint);
      return;
    }
    if (mode === "duo") {
      const row = document.createElement("div");
      row.className = "cc-optbar";
      for (const c of CHARACTERS) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `cc-open${c.id === foeChar ? "" : " cc-ghost"}`;
        b.textContent = `星星用 ${c.name}`;
        b.addEventListener("click", () => {
          foeChar = c.id;
          api.play("tap");
          startDuo();
        });
        row.appendChild(b);
      }
      stage.appendChild(row);
      return;
    }
    const row = document.createElement("div");
    row.className = "cc-optbar";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cc-open";
    b.textContent = "▶ 进训练场";
    b.addEventListener("click", () => {
      api.play("tap");
      startTraining();
    });
    row.appendChild(b);
    stage.appendChild(row);
    const hint = document.createElement("div");
    hint.className = "cc-note";
    hint.textContent = "训练场不结算胜负:帧数据、输入历史都看得见,假人的行为随时能换。";
    stage.appendChild(hint);
  }

  function startVersus(): void {
    clearStage();
    chip.textContent = `🤝 对手:${AI_TIER_LABELS[tier]}`;
    const seed = 991 + Math.floor(Math.random() * 100000);
    const foe = CHARACTERS[(seed + 3) % CHARACTERS.length].id;
    arena = createArena(stage, {
      cfg: versusMatchConfig(chosenChar, foe === chosenChar ? "xingxing" : foe),
      goalText: "三局两胜,先赢两回合",
      theme: "night",
      seats: [{ kind: "duo" }, { kind: "ai", tier, seed }],
      sfx: (n) => api.play(n),
      onEnd: (m) => {
        const won = m.winner === 0;
        if (won) api.addStars(2);
        const s = m.stats[0];
        showOver(
          won ? "这一场赢下来啦!" : "这一场先到这里",
          `回合比分 ${m.wins[0]}:${m.wins[1]}。最大连击 ${s.maxCombo} 连 · 打中 ${s.hits} 下 · 投技 ${s.throws} 次 · 超必 ${s.supersUsed} 次 · 取消 ${s.cancels} 次。`,
          "🔁 再打一场",
          startVersus
        );
      }
    });
  }

  function startEndless(): void {
    clearStage();
    const cfg = endlessConfig(streak, chosenChar);
    chip.textContent = `♾️ 连胜 ${streak} · 对手 ${AI_TIER_LABELS[cfg.tier]}`;
    arena = createArena(stage, {
      cfg: endlessMatchConfig(cfg, chosenChar),
      goalText: `第 ${streak + 1} 场,赢了就继续。最高连胜 ${best}`,
      theme: (["sakura", "night", "candy"] as const)[streak % 3],
      seats: [{ kind: "duo" }, { kind: "ai", tier: cfg.tier, seed: 5000 + streak * 31 }],
      sfx: (n) => api.play(n),
      onEnd: (m) => {
        const s = m.stats[0];
        if (m.winner === 0) {
          streak += 1;
          best = save.recordEndlessBest(meta.id, streak);
          if (streak % 3 === 0) api.addStars(1);
          showOver(
            "赢啦,继续!",
            `已经连胜 ${streak} 场,最高纪录 ${best} 场。这一场最大连击 ${s.maxCombo} 连 · 打中 ${s.hits} 下。`,
            "▶ 下一场",
            startEndless
          );
        } else {
          showOver(
            "这一轮到此为止",
            `连胜 ${streak} 场,最高纪录 ${best} 场。这一场最大连击 ${s.maxCombo} 连。休息一下再来一轮吧!`,
            "🔁 重新开始",
            () => {
              streak = 0;
              startEndless();
            }
          );
        }
      }
    });
  }

  function startDuo(): void {
    clearStage();
    chip.textContent = "👫 朵朵 WASD+F/G · 星星 方向键+L/K";
    arena = createArena(stage, {
      cfg: versusMatchConfig(chosenChar, foeChar),
      goalText: "三局两胜,两个人一台设备",
      theme: "candy",
      seats: [{ kind: "duo" }, { kind: "star" }],
      sfx: (n) => api.play(n),
      onEnd: (m) => {
        const who = m.winner === 0 ? characterById(chosenChar).name : characterById(foeChar).name;
        const wi = m.winner === 1 ? 1 : 0;
        showOver(
          `${who} 这一场赢啦!`,
          `回合比分 ${m.wins[0]}:${m.wins[1]},胜方最大连击 ${m.stats[wi].maxCombo} 连。换个角色再来一场?`,
          "🔁 再来一场",
          startDuo
        );
      }
    });
  }

  function startTraining(): void {
    clearStage();
    chip.textContent = "🎯 训练场";
    const holder = document.createElement("div");
    stage.appendChild(holder);
    const created = createArena(holder, {
      cfg: trainingMatchConfig(chosenChar, foeChar === chosenChar ? "dundun" : foeChar),
      goalText: "训练场:不结算胜负,慢慢试连段",
      theme: "sakura",
      training: true,
      seats: [{ kind: "duo" }, { kind: "dummy", mode: "stand" }],
      sfx: (n) => api.play(n)
    }) as Arena & { setDummy?: (mode: DummyMode) => void };
    arena = created;

    const row = document.createElement("div");
    row.className = "cc-train";
    for (const mode2 of DUMMY_MODES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cc-open cc-ghost";
      b.textContent = DUMMY_LABELS[mode2];
      b.addEventListener("click", () => {
        api.play("tap");
        created.setDummy?.(mode2);
      });
      row.appendChild(b);
    }
    stage.appendChild(row);

    const wake = document.createElement("div");
    wake.className = "cc-note";
    wake.textContent = `起身三选一:${Object.values(WAKEUP_LABELS).join(" / ")}。超必 LV1 要 ${SUPER_LV1_COST} 能量,LV2 要 ${SUPER_LV2_COST}。`;
    stage.appendChild(wake);
  }

  menu();

  return {
    destroy() {
      arena?.destroy();
      arena = null;
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 模式入口条:按 meta.modes 推,不硬写
// ---------------------------------------------------------------------------

/** 这一款按 `meta.modes` 算出来的模式口径(首页玩法芯片读的是同一份 meta) */
export const MODE_COMPAT = compatFromMeta(meta);

/** 本款自己的入口名 ↔ 三大类的对应关系;顺序就是入口条从左到右的顺序 */
const MODE_ENTRIES: ModeEntry<ExtraMode>[] = [
  { key: "versus", kind: "versus", versusKind: "ai" },
  { key: "endless", kind: "endless" },
  { key: "duo", kind: "versus", versusKind: "hotseat" },
  // 训练场不是一种对局模式,不归 meta.modes 管,永远开着
  { key: "train" }
];

/**
 * 真正摆出来的入口。
 * 以前这里是硬写的 `["versus","endless","duo"]`,`meta.modes` 一改就与首页芯片各说各话;
 * 现在少写一个模式,入口条自己就少一个按钮。
 */
export const MODE_KEYS: ExtraMode[] = modeEntryKeys(MODE_COMPAT, MODE_ENTRIES);

/** 模式菜单顶上那句话,措辞走 `describeModes` 的共享口径,十二款不各写各的 */
export const MODE_SUMMARY = describeModes(MODE_COMPAT);

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "cc-modebar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "cc-modetip";
  modeTip.textContent = MODE_SUMMARY;
  bar.appendChild(modeTip);
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
  }

  MODE_KEYS.forEach((mkey) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cc-open";
    btn.textContent = MODE_TITLE[mkey];
    btn.addEventListener("click", () => {
      if (mode) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      mode = mountExtra(modeHost, api, mkey, closeMode);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "轻击命中之后马上按重击就是取消,连段一下子就长了。",
      grandMessage: "188 关全部拿下,连招杯冠军就是你!",
      guideTitle: "连招对决 · 帧数笔记"
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    }
  };
}

/** 给测试钉住的关键常量 */
export const CLASH_CONSTS = {
  STAGE_HEIGHT,
  GROUND_Y,
  cutin: superCutinFrames(false),
  moveTotal: (id: string, slot: MoveSlot): number => totalFrames(characterById(id).moves[slot])
};
