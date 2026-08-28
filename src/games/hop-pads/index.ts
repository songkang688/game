import { meta } from "./meta";
export { meta };

// 跳跳台 —— 按住蓄力,松手跳到下一座台。
//
// 手感、台面、关卡、幽灵全在 physics.ts / pads.ts / run.ts / levels.ts / ai.ts 里,
// 这个文件只负责把它画出来、把手指和键盘接上去:
// Canvas 伪 2.5D(椭圆台面 + 侧壁,纯数学等距投影,没有任何 3D 库),
// 底下一根蓄力条,蓄力时角色压扁、起跳拉伸、落地扬起小尘土。
// 四种玩法都在这儿:188 关闯关、幽灵对战、无尽跳、双人上下分屏。
import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { TIER_FACES, TIER_NAMES, ghostLine, playGhost, type AiTier, type GhostRun } from "./ai";
import {
  drawChargeRing,
  drawCloudPuff,
  drawHeroSprite,
  drawHills,
  drawIsland,
  drawPadMotif,
  drawParticles,
  drawPauseBars,
  drawProgressRing,
  drawRescueCloud,
  drawSideStripes,
  drawSpringCoil,
  drawStar,
  fogAlpha,
  padTopPattern,
  skyTheme,
  spawnDustPuff,
  spawnPerfectBurst,
  spawnShards,
  stepParticles,
  type HeroPose,
  type HeroVariant,
  type Particle,
} from "./art";
import guideBook from "./guide";
import {
  CATCH_LINE,
  CHAPTERS,
  buildLevel,
  endlessDifficulty,
  levelPassed,
  levelStars,
  loseLine,
  matchDifficulty,
  matchSeed,
  winLine,
  type HopLevel,
} from "./levels";
import { KIND_NAMES, padTick, perfectRadius, type Difficulty, type Pad } from "./pads";
import { MAX_HOLD, clamp, clamp01, jumpApex, landPoint, powerFromHold, type Point } from "./physics";
import { aimYaw, createRun, hop, requiredPower, type HopResult, type RunState } from "./run";

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.hp-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:none;display:flex;flex-direction:column;gap:8px;
  background:linear-gradient(180deg,#FFF3E8,#F1F0FF);border-radius:18px;padding:10px;position:relative;}
.hp-bar{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:6px;}
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.hp-bar[hidden]{display:none;}
.hp-open{border:none;border-radius:16px;min-height:44px;padding:9px 16px;font-size:15px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#fff;background:linear-gradient(180deg,#F2A268,#DB7F42);
  box-shadow:0 4px 0 #B4642F;}
.hp-open:active{transform:translateY(2px);box-shadow:0 2px 0 #B4642F;}
.hp-open-vs{background:linear-gradient(180deg,#7FA7EA,#5A82C9);box-shadow:0 4px 0 #446299;}
.hp-open-vs:active{box-shadow:0 2px 0 #446299;}
.hp-open-duo{background:linear-gradient(180deg,#EE94BE,#D66E9C);box-shadow:0 4px 0 #AB5178;}
.hp-open-duo:active{box-shadow:0 2px 0 #AB5178;}
.hp-shell{display:flex;flex-direction:column;gap:8px;}
.hp-shelltop{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.hp-back{border:none;border-radius:999px;min-height:44px;padding:7px 13px;font-size:15px;font-weight:900;
  cursor:pointer;background:#ffffffd9;color:#9A5A2C;box-shadow:0 3px 0 rgba(170,120,70,.3);font-family:inherit;}
.hp-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,120,70,.3);}
.hp-chip{flex:1;text-align:center;font-size:16px;font-weight:900;color:#9A5A2C;min-width:120px;}
.hp-stage{position:relative;border-radius:16px;overflow:hidden;background:#FFF8F0;
  box-shadow:0 4px 14px rgba(190,150,120,.22);}
.hp-canvas{display:block;width:100%;height:auto;}
/* 整块画面都是蓄力热区:360px 单手随便按哪儿都能蓄力 */
.hp-hot{position:absolute;inset:0;cursor:pointer;background:transparent;border:none;padding:0;margin:0;}
.hp-hud{position:absolute;left:10px;top:8px;right:10px;display:flex;justify-content:space-between;
  gap:8px;pointer-events:none;font-size:17px;font-weight:900;color:#8A5330;text-shadow:0 1px 0 #fff;}
.hp-hud-r{color:#B4437B;}
.hp-say{text-align:center;font-size:15px;font-weight:800;color:#8A6A50;line-height:1.5;min-height:22px;}
.hp-say-oops{color:#C1567F;}
.hp-over{position:absolute;inset:0;background:rgba(255,248,242,.95);display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:10px;text-align:center;padding:18px;}
.hp-over-t{font-size:21px;font-weight:900;color:#9A5A2C;}
.hp-result-cv{display:block;border-radius:12px;box-shadow:inset 0 0 0 1px rgba(190,150,120,.28);}
.hp-over-s{font-size:16px;font-weight:700;color:#7C6350;line-height:1.6;max-width:300px;}
.hp-tip{text-align:center;font-size:14px;font-weight:700;color:#9A8676;line-height:1.5;}
.hp-duo{display:flex;flex-direction:column;gap:8px;}
@media (max-height:500px){.hp-duo{gap:4px;}}
.hp-name{position:absolute;left:12px;bottom:36px;font-size:15px;font-weight:900;color:#8A5330;
  pointer-events:none;text-shadow:0 1px 0 #fff;}
@media (max-width:420px){
  .hp-chip{font-size:16px;}
  .hp-open{padding:9px 13px;font-size:15px;}
}
`;

// ---------------------------------------------------------------------------
// 投影:等距伪 2.5D,纯数学,不引任何 3D 库
// ---------------------------------------------------------------------------

/** 纵深方向压扁多少(等距透视的味道就靠它) */
export const DEPTH_SQUASH = 0.52;
/** 台面侧壁厚度(世界单位) */
export const WALL_H = 26;
/** 掉下去的动画时长(秒):必须先掉再结算,禁止瞬死 */
export const FALL_TIME = 1.15;
/** 底部蓄力条的高度(CSS 像素),360px 上也要看得清 */
export const CHARGE_BAR_H = 16;
/** 蓄满力之后蓄力条换的那一档颜色 */
export const FULL_BAR_COLOR = "#E2703A";

export interface Camera {
  x: number;
  z: number;
  /** 世界单位 → 像素 */
  scale: number;
  /** 画面宽高(CSS 像素) */
  w: number;
  h: number;
  /** 地平线落在画面高度的百分之多少(矮画布往上提一点,前面才看得见几座) */
  horizon?: number;
  /** 落地时镜头往下沉一点(reduced-motion 下恒为 0) */
  shake: number;
}

/** 世界坐标 → 屏幕坐标(纯函数,单测直接查) */
export function project(cam: Camera, x: number, z: number, y = 0): { sx: number; sy: number } {
  return {
    sx: cam.w / 2 + (x - cam.x) * cam.scale,
    sy:
      cam.h * (cam.horizon ?? 0.74) -
      (z - cam.z) * cam.scale * DEPTH_SQUASH -
      y * cam.scale +
      cam.shake,
  };
}

/** 画布再矮也不能低于这个高度:低于它蓄力条和前面几座台面就挤在一起看不清了 */
export const STAGE_MIN_H = 170;

/**
 * 画布该多高:想按宽算出 want,可视余量却只有 room(root 顶到 `.game-stage`
 * 裁切线),画布下面的说明行还要占 below。
 *
 * 只按宽算的后果在横屏上量到过:640×360 上 `clamp(cssW×1.06, 280, 460)` 给出
 * 460px,而舞台可视高只剩 ~280px——画布下半截(角色、蓄力条)全在裁切线以下,
 * 这是一款「按住蓄力、看条松手」的游戏,看不见条等于闭眼玩。
 * 量不出 room(测试桩 / 独立挂载 / 没有裁切祖先)时原样返回 want,老行为一字不差。
 */
export function stageHeightPx(want: number, room: number, below: number, min = STAGE_MIN_H): number {
  if (!Number.isFinite(want)) return want;
  if (!Number.isFinite(room) || room <= 0) return want;
  const fits = Math.floor(room - Math.max(0, Number.isFinite(below) ? below : 0) - 4);
  return Math.max(min, Math.min(want, fits));
}

/** 双人同屏每块画布的旧定高(量不出舞台时退回这个数,单测桩走这里) */
export const DUO_PANE_FALLBACK = 236;
/** 双人块再矮也要看得见蓄力条;比单人 STAGE_MIN_H 更让,否则两块叠起来会顶出 412 */
export const DUO_STAGE_MIN_H = 108;

/**
 * N-54：双人两块画布按「(余量 − 工具) / 2」钳高。
 * 量不出 room 时退回 DUO_PANE_FALLBACK,单人 stageHeightPx 一字不碰。
 */
export function duoPaneHeightPx(room: number, chrome: number, gap = 8): number {
  if (!Number.isFinite(room) || room <= 0) return DUO_PANE_FALLBACK;
  const tool = Math.max(0, Number.isFinite(chrome) ? chrome : 0);
  const each = Math.floor((room - tool - Math.max(0, gap)) / 2);
  return Math.max(DUO_STAGE_MIN_H, each);
}

/** 画面能装下多少纵深:决定 scale。台面最远也要能看见前面三四座 */
export function fitScale(w: number, h: number): number {
  return Math.max(0.5, Math.min(w / 480, h / 450));
}

/** 矮画布(上下分屏)把地平线往上提,免得角色贴着蓄力条 */
export function horizonFor(h: number): number {
  return h < 280 ? 0.68 : 0.74;
}

// ---------------------------------------------------------------------------
// 画一座台面:椭圆台顶 + 侧壁 + 完美圈
// ---------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;

function ellipse(ctx: Ctx, sx: number, sy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(sx, sy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
}

/** drawPad 的视觉选项:入场淡入、深度雾、完美发光、弹簧压缩全在这儿,判定不认它们 */
export interface PadDrawOpts {
  /** 是不是下一座目标(完美圈画亮一点) */
  target?: boolean;
  /** 深度雾浓度 0..FOG_MAX(远台罩一层天空色) */
  fog?: number;
  /** 雾的颜色(跟着时段的地平线色走) */
  fogColor?: string;
  /** 入场进度 0..1:淡入 + 从下往上浮 4px,1 表示已就位 */
  entry?: number;
  /** 完美落点后的台顶发光 0..1 */
  glow?: number;
  /** 玩家正踩着它(一次台的裂纹扩展到 4 道) */
  standing?: boolean;
  /** 弹簧压缩脉冲 0..1(起跳 / 被弹那两帧) */
  spring?: number;
}

/** 画一座台面:椭圆台顶 + 侧壁 + 种类图案 + 完美圈(种类靠图案+侧壁色双通道,不再用字符占位) */
export function drawPad(ctx: Ctx, cam: Camera, pad: Pad, o: PadDrawOpts = {}): void {
  if (!pad.alive || pad.r <= 0) return;
  const style = padTopPattern(pad.kind);
  const entry = o.entry ?? 1;
  const springSq = (o.spring ?? 0) > 0 ? Math.sin(Math.min(1, o.spring ?? 0) * Math.PI) * 0.22 : 0;
  const top = project(cam, pad.x, pad.z, 0);
  const sy = top.sy + (1 - entry) * 4;
  const rx = pad.r * cam.scale;
  const ry = pad.r * cam.scale * DEPTH_SQUASH;
  const wall = WALL_H * cam.scale * (1 - springSq);

  if (entry < 1) ctx.globalAlpha = entry;

  // 侧壁:上下两个椭圆之间的一段柱身
  ctx.fillStyle = style.side;
  ctx.beginPath();
  ctx.ellipse(top.sx, sy + wall, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(top.sx - rx, sy);
  ctx.ellipse(top.sx, sy, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();

  // 侧壁装饰:移动台条纹 / 弹簧台弹簧圈线
  if (pad.kind === "slider") drawSideStripes(ctx, top.sx, sy, rx, ry, wall, style.accent);
  else if (pad.kind === "spring") drawSpringCoil(ctx, top.sx, sy, rx, ry, wall, style.accent);

  // 台顶
  ctx.fillStyle = style.top;
  ellipse(ctx, top.sx, sy, rx, ry);
  ctx.fill();

  // 顶面图案:每种台一张脸(一次台被踩住时裂纹 2 道扩到 4 道)
  drawPadMotif(ctx, pad.kind, top.sx, sy, rx, ry, pad.kind === "once" ? (o.standing ? 4 : 2) : 0);

  // 完美圈:浅浅一圈,告诉孩子要往哪儿落
  const pr = perfectRadius(pad) * cam.scale;
  ctx.fillStyle = o.target ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.55)";
  ellipse(ctx, top.sx, sy, pr, pr * DEPTH_SQUASH);
  ctx.fill();

  // 完美落点后的台顶短暂发光
  const glow = o.glow ?? 0;
  if (glow > 0) {
    ctx.globalAlpha = entry * glow * 0.65;
    ctx.fillStyle = "#FFD76A";
    ellipse(ctx, top.sx, sy, rx, ry);
    ctx.fill();
  }

  // 深度雾:远台罩一层淡天空色,拉开纵深
  const fog = o.fog ?? 0;
  if (fog > 0) {
    ctx.globalAlpha = entry * fog;
    ctx.fillStyle = o.fogColor ?? "#FFF3D9";
    ctx.beginPath();
    ctx.ellipse(top.sx, sy + wall, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(top.sx - rx, sy);
    ctx.ellipse(top.sx, sy, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, top.sx, sy, rx, ry);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** drawHero 的视觉选项:全是造型层,判定一个数都不掺 */
export interface HeroDrawOpts {
  /** 朵朵(花苞呆毛 + 粉裙边)还是星星(星星呆毛 + 黄披风) */
  variant?: HeroVariant;
  /** 姿态决定表情与小手:蓄力眯眼 / 飞行圆睁 / 落地笑 / 坠落 >< 眼 */
  pose?: HeroPose;
  /** 连击 ≥ 3 头顶冒小皇冠(reduced 只发光) */
  crown?: boolean;
  reduced?: boolean;
  /** 局内时间(秒):待机呼吸与眨眼 */
  t?: number;
  /** 飞行中的历史位置(世界坐标),星星的披风拖着它飘 */
  trail?: ReadonlyArray<{ x: number; z: number; y: number }>;
}

/** 角色:圆滚滚的跳跳员,蓄力压扁、起跳拉伸(squash/stretch 公式一字未动) */
export function drawHero(
  ctx: Ctx,
  cam: Camera,
  pos: { x: number; z: number; y: number },
  squash: number,
  color: string,
  o: HeroDrawOpts = {}
): void {
  const p = project(cam, pos.x, pos.z, pos.y);
  const base = 19 * cam.scale;
  const rx = base * (1 + squash * 0.42);
  const ry = base * (1 - squash * 0.46);

  // 影子落在地面高度上
  const ground = project(cam, pos.x, pos.z, 0);
  ctx.fillStyle = "rgba(120,90,70,.18)";
  ellipse(ctx, ground.sx, ground.sy, rx * 0.9, rx * 0.42);
  ctx.fill();

  const trail = (o.trail ?? []).map((q) => {
    const s = project(cam, q.x, q.z, q.y);
    return { sx: s.sx, sy: s.sy };
  });
  drawHeroSprite(ctx, {
    x: p.sx,
    y: p.sy,
    rx,
    ry,
    color,
    variant: o.variant ?? "duo",
    pose: o.pose ?? "idle",
    crown: o.crown ?? false,
    reduced: o.reduced ?? false,
    t: o.t ?? 0,
    trail,
  });
}

// ---------------------------------------------------------------------------
// 一条台路 = 一块画布 + 一套输入
// ---------------------------------------------------------------------------

export type StagePhase = "ready" | "charging" | "flying" | "falling" | "over";

export interface StageOpts {
  seed: number;
  difficulty: Difficulty;
  /** 站住这么多座就算达标(无尽传 Infinity) */
  goal?: number;
  /** 训练关:画出落点辅助圆 */
  assist?: boolean;
  /** 这一路认哪些键蓄力(不区分大小写) */
  keys?: readonly string[];
  /** 收力键:蓄力蓄过头了想反悔,按这个把力卸掉,回到站定状态(不消耗这一跳) */
  cancelKeys?: readonly string[];
  /** 分屏时显示的名字 */
  name?: string;
  /** 角色颜色 */
  color?: string;
  /** 角色造型:朵朵还是星星(纯视觉,判定不认它) */
  variant?: HeroVariant;
  /** 画布高度(CSS 像素),不给就按宽度自适应 */
  height?: number;
  /** 无尽模式:每跳一座重算一次难度 */
  ramp?: (hops: number) => Difficulty;
  sfx: (n: SoundName) => void;
  /** 每一跳落地后回调 */
  onHop?: (res: HopResult, run: RunState) => void;
  /** 站满 goal 座 */
  onGoal?: (run: RunState) => void;
  /** 掉下去、这一局结束(下落动画播完才会调) */
  onOver?: (run: RunState) => void;
  /** 顶栏右边那行小字 */
  info?: () => string;
}

export interface Stage {
  destroy: () => void;
  /** 给单测用:直接开始 / 结束蓄力,不必伪造指针事件 */
  press: () => void;
  release: (holdMs?: number) => void;
  /** 收力:把蓄到一半的力卸掉,回到站定状态。真收掉了才返回 true */
  cancel: () => boolean;
  /** 力度是不是已经蓄满了(再按下去也不会更远) */
  full: () => boolean;
  /** 屏幕上正闪着的那句话(没有就是空串) */
  flash: () => string;
  phase: () => StagePhase;
  state: () => RunState;
  /** 暂停 / 继续 */
  setPaused: (v: boolean) => void;
  /** 手动推进 n 毫秒(单测用) */
  tick: (ms: number) => void;
  /** 当前镜头(单测查 reduced-motion 有没有真的不晃) */
  camera: () => Camera;
  /** 单测用:视觉特效快照(粒子数 / 扩散环 / 台顶发光 / 皇冠 / 弹簧脉冲) */
  fx: () => { particles: number; ring: number; glow: number; crown: boolean; spring: number };
  root: HTMLElement;
}

interface Leg {
  from: Point;
  to: Point;
  apex: number;
  dur: number;
}

/** 指针 / 触摸事件里我们只关心「是谁的手指」这一点 */
interface PointerLikeEvent {
  preventDefault?: () => void;
  pointerId?: number;
  changedTouches?: ArrayLike<{ identifier?: number }>;
}

/**
 * 方向键 / `WASD` 在这一款里本来就没有语义 —— 跳跳台是**单键蓄力**玩法,
 * 一个键管按住与松手,四个方向没有任何东西可指。
 *
 * 硬给它们接一个动作比不接更糟(按左右会莫名其妙起跳),所以这里只做一件事:
 * 按到了就指个路,告诉孩子真正该按的是哪个键,免得他以为键盘按坏了。
 */
export const IDLE_KEYS = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"] as const;

function keyFace(k: string): string {
  if (k === " " || k === "spacebar") return "空格";
  return k.toUpperCase();
}

/** 「这一款只用一个键」那句指路话。按这一路真正认的键现编,双人同屏左右两边各说各的 */
export function singleKeyHint(keys: readonly string[], cancelKeys: readonly string[]): string {
  const faces: string[] = [];
  for (const k of keys) {
    const face = keyFace(k);
    if (!faces.includes(face)) faces.push(face);
  }
  const back = cancelKeys.length > 0 ? `,蓄过头了按 ${keyFace(cancelKeys[0])} 收力` : "";
  return `这一款只用一个键:按住 ${faces.join(" 或 ")} 蓄力,松手就跳${back}`;
}

function prefersReducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return Boolean(mm?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

export function createStage(host: HTMLElement, opts: StageOpts): Stage {
  const reduced = prefersReducedMotion();
  const keys = (opts.keys ?? ["f", " ", "spacebar"]).map((k) => k.toLowerCase());
  const cancelKeys = (opts.cancelKeys ?? ["g"]).map((k) => k.toLowerCase());
  const hintLine = singleKeyHint(keys, cancelKeys);
  const heroColor = opts.color ?? "#F2A268";
  const heroVariant: HeroVariant = opts.variant ?? "duo";
  const goal = opts.goal ?? Number.POSITIVE_INFINITY;

  const root = document.createElement("div");
  root.className = "hp-stage";
  const canvas = document.createElement("canvas");
  canvas.className = "hp-canvas";
  canvas.setAttribute("role", "img");
  const hud = document.createElement("div");
  hud.className = "hp-hud";
  const hudL = document.createElement("span");
  const hudR = document.createElement("span");
  hudR.className = "hp-hud-r";
  hud.append(hudL, hudR);
  const hot = document.createElement("button");
  hot.type = "button";
  hot.className = "hp-hot";
  hot.setAttribute("aria-label", "按住蓄力,松手起跳");
  root.append(canvas, hud, hot);
  if (opts.name) {
    const tag = document.createElement("div");
    tag.className = "hp-name";
    tag.textContent = opts.name;
    root.appendChild(tag);
  }
  host.appendChild(root);

  let run: RunState = createRun(opts.seed, opts.difficulty);
  let phase: StagePhase = "ready";
  let clock = 0;
  let holdMs = 0;
  let paused = false;
  /** 跳满目标座数后画面就定格等结算,和玩家自己按的暂停分开记 */
  let frozen = false;
  let over = false;
  let goalHit = false;
  let dust = 0;
  let fallT = 0;
  let legs: Leg[] = [];
  let legIndex = 0;
  let legT = 0;
  let pending: { state: RunState; result: HopResult } | null = null;
  let heroPos = { x: 0, z: 0, y: 0 };
  let flashText = "";
  let flashT = 0;
  /** 落台后的笑脸 / 平展小手还剩多少秒 */
  let landT = 0;
  /** 星星的披风要拖着最近几帧的位置飘 */
  let trail: Array<{ x: number; z: number; y: number }> = [];
  /** 屏幕坐标系的粒子:完美星星 / 落地尘土 / 一次台碎片 */
  let particles: Particle[] = [];
  /** 弹簧压缩脉冲:哪座台、还剩多少 */
  let springT = 0;
  let springIdx = -1;
  /** 完美落点后的台顶发光:哪座台、还剩多少 */
  let glowT = 0;
  let glowIdx = -1;
  /** 完美落点的金色扩散环:锚在世界坐标上,镜头动它也不飘 */
  let ringT = 0;
  let ringAt = { x: 0, z: 0 };
  /** 每座台第一次被看见的时刻:入场淡入 + 上浮用(reduced 直接就位) */
  const born = new Map<number, number>();
  const cam: Camera = { x: 0, z: 0, scale: 1, w: 360, h: 400, shake: 0 };

  // ---- 画布尺寸 ----

  /** 一个盒子的下沿(测试桩的 rect 可能没有 bottom,用 top+height 兜底) */
  const rectBottom = (r: { top: number; bottom?: number; height: number }): number =>
    Number.isFinite(r.bottom) ? (r.bottom as number) : r.top + r.height;

  /** root 顶到平台舞台(.game-stage,定高会裁内容)裁切线还剩多少;量不到返回 NaN */
  function stageRoomPx(): number {
    if (typeof root.getBoundingClientRect !== "function") return Number.NaN;
    let node: HTMLElement | null = root.parentElement ?? null;
    for (let i = 0; node && i < 10; i++) {
      if (typeof node.className === "string" && node.className.includes("game-stage")) {
        if (typeof node.getBoundingClientRect !== "function") break;
        const r = node.getBoundingClientRect();
        const inner =
          typeof node.clientHeight === "number" && node.clientHeight > 0
            ? (node.clientTop || 0) + node.clientHeight
            : r.height;
        if (!Number.isFinite(r.top) || !Number.isFinite(inner) || inner <= 0) break;
        const top = root.getBoundingClientRect().top;
        return Number.isFinite(top) ? r.top + inner - top : Number.NaN;
      }
      node = node.parentElement ?? null;
    }
    return Number.NaN;
  }

  /** 画布下面同一屏还有多高的家当(说明行 / 提示行):量最外层 .hp-wrap 下沿与 root 下沿之差 */
  function belowChromePx(): number {
    if (typeof root.getBoundingClientRect !== "function") return 0;
    let node: HTMLElement | null = root.parentElement ?? null;
    for (let i = 0; node && i < 10; i++) {
      if (typeof node.className === "string" && node.className.includes("hp-wrap")) {
        if (typeof node.getBoundingClientRect !== "function") break;
        return Math.max(0, rectBottom(node.getBoundingClientRect()) - rectBottom(root.getBoundingClientRect()));
      }
      node = node.parentElement ?? null;
    }
    return 0;
  }

  function resize(): void {
    const cssW = Math.max(240, host.clientWidth || root.clientWidth || 360);
    // 双人上下分屏(opts.height)有自己的一套定高,这里只钳单人画布
    const cssH =
      opts.height ?? stageHeightPx(Math.round(clamp(cssW * 1.06, 280, 460)), stageRoomPx(), belowChromePx());
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;
    cam.w = cssW;
    cam.h = cssH;
    cam.scale = fitScale(cssW, cssH);
    cam.horizon = horizonFor(cssH);
  }
  resize();
  // 挂载那一刻可能还没排好版,量不准余量;抽空补量一次。
  // 不用 rAF:测试桩的 flushFrames 一帧只弹一个回调,多排一个会把主循环挤后一帧。
  const fitTimer = setTimeout(() => resize(), 0);

  const ctx = canvas.getContext("2d") as Ctx | null;

  function heroAt(): { x: number; z: number; y: number } {
    return heroPos;
  }

  function power(): number {
    return powerFromHold(holdMs);
  }

  /**
   * 力度封顶了没有。`powerFromHold` 在 `MAX_HOLD` 之后就不再涨,
   * 可屏幕上一点变化都没有,孩子按着不放只能靠「飞过头」才知道按久了。
   */
  function isFull(): boolean {
    return phase === "charging" && holdMs >= MAX_HOLD;
  }

  // ---- 蓄力 / 起跳 ----
  function press(): void {
    if (paused || frozen || over || phase !== "ready") return;
    phase = "charging";
    holdMs = 0;
  }

  /**
   * 收力:蓄过头了想反悔,按收力键把力卸掉,人还站在原地。
   * 这一跳不算数、连击不断——单键蓄力玩法里,"按下去就只能被迫跳出去"是最劝退的一件事。
   */
  function cancelCharge(): boolean {
    if (paused || frozen || over || phase !== "charging") return false;
    phase = "ready";
    holdMs = 0;
    opts.sfx("tap");
    flashText = "收住啦,重新蓄力";
    flashT = 0.9;
    return true;
  }

  function buildLegs(step: { state: RunState; result: HopResult }): Leg[] {
    const out: Leg[] = [];
    let node: HopResult | null = step.result;
    while (node) {
      out.push({
        from: { x: node.from.x, z: node.from.z },
        to: { x: node.landing.x, z: node.landing.z },
        apex: jumpApex(node.power),
        dur: node.flight,
      });
      node = node.bonus;
    }
    return out;
  }

  function release(forcedHold?: number): void {
    if (paused || frozen || over || phase !== "charging") return;
    if (forcedHold !== undefined) holdMs = forcedHold;
    const p = power();
    run = { ...run, time: clock };
    // 从弹簧台上起跳:柱身压缩回弹两帧(纯视觉)
    if (run.pads[run.index]?.kind === "spring" && !reduced) {
      springIdx = run.index;
      springT = 1;
    }
    pending = hop(run, p);
    legs = buildLegs(pending);
    legIndex = 0;
    legT = 0;
    phase = "flying";
    holdMs = 0;
    opts.sfx("jump");
  }

  function settleLanding(): void {
    if (!pending) return;
    const res = pending.result;
    const prevPads = run.pads;
    const prevIndex = run.index;
    run = pending.state;
    clock = run.time;
    pending = null;

    // 一次台跳走即塌:碎成 3 块下坠(判定早在 run.ts 里定死,这儿只演给眼睛看)
    for (let j = prevIndex; j < run.index; j++) {
      const now = run.pads[j];
      const was = prevPads[j];
      if (now && was && now.kind === "once" && !now.alive && was.alive) {
        const snap = padTick(was, clock);
        const g = project(cam, snap.x, snap.z, 0);
        particles.push(...spawnShards(g.sx, g.sy, cam.scale, padTopPattern("once").side, reduced));
      }
    }

    if (res.verdict === "miss") {
      phase = "falling";
      fallT = 0;
      opts.sfx("oops");
      flashText = CATCH_LINE;
      flashT = FALL_TIME + 1;
      return;
    }

    phase = "ready";
    dust = 1;
    landT = 0.2;
    if (!reduced) cam.shake = 5;
    const g = project(cam, heroPos.x, heroPos.z, 0);
    if (res.verdict === "perfect") {
      opts.sfx("coin");
      flashText = res.combo > 1 ? `踩中圆心!${res.combo} 连` : "踩中圆心!";
      // 完美落点:4 颗星星 + 金色扩散环 + 台顶发光(reduced 只留发光)
      particles.push(...spawnPerfectBurst(g.sx, g.sy, cam.scale, reduced));
      if (!reduced) {
        ringT = 1;
        ringAt = { x: heroPos.x, z: heroPos.z };
      }
      glowT = 1;
      glowIdx = run.index;
    } else {
      opts.sfx("tap");
      flashText = "站住啦,连击重新数";
      // 普通落地:两粒尘土
      particles.push(...spawnDustPuff(g.sx, g.sy, cam.scale, reduced));
    }
    flashT = 1.1;
    if (res.bonus) {
      opts.sfx("pop");
      flashText = `弹簧台!直接送你一跳,${run.combo} 连`;
      // 被弹起的那座弹簧台压缩一下再回弹
      if (!reduced) {
        springIdx = res.targetIndex;
        springT = 1;
      }
    }
    if (opts.ramp) run = { ...run, difficulty: opts.ramp(run.hops) };
    opts.onHop?.(res, run);
    if (!goalHit && run.hops >= goal) {
      goalHit = true;
      // 闯关 / 对战 / 双人都是跳满就收工,画面停在这一刻等结算
      frozen = true;
      opts.sfx("win");
      opts.onGoal?.(run);
    }
  }

  function finishFall(): void {
    if (over) return;
    over = true;
    phase = "over";
    opts.onOver?.(run);
  }

  // ---- 每帧 ----
  function step(dt: number): void {
    if (phase === "ready" || phase === "charging") {
      clock += dt;
      run.time = clock;
      if (phase === "charging") {
        const before = holdMs;
        holdMs = Math.min(MAX_HOLD * 1.6, holdMs + dt * 1000);
        // 刚刚跨过封顶线的那一帧闪一次,之后蓄力条一直保持满力配色,不再重复弹字
        if (before < MAX_HOLD && holdMs >= MAX_HOLD) {
          flashText = "💪 满力啦,松手就跳";
          flashT = 0.8;
        }
      }
      const cur = padTick(run.pads[run.index], clock);
      heroPos = { x: cur.x, z: cur.z, y: 0 };
    } else if (phase === "flying") {
      clock += dt;
      const leg = legs[legIndex];
      if (!leg) {
        settleLanding();
      } else {
        legT += dt;
        const u = clamp01(leg.dur > 0 ? legT / leg.dur : 1);
        heroPos = {
          x: leg.from.x + (leg.to.x - leg.from.x) * u,
          z: leg.from.z + (leg.to.z - leg.from.z) * u,
          y: 4 * leg.apex * u * (1 - u),
        };
        if (u >= 1) {
          legIndex++;
          legT = 0;
          if (legIndex >= legs.length) settleLanding();
        }
      }
    } else if (phase === "falling") {
      clock += dt;
      fallT += dt;
      // 往屏幕下方掉出去,再由云朵接住 —— 掉下去不是死亡
      heroPos = { ...heroPos, y: -260 * fallT * fallT };
      if (fallT >= FALL_TIME) finishFall();
    }

    if (dust > 0) dust = Math.max(0, dust - dt * 2.4);
    if (flashT > 0) flashT = Math.max(0, flashT - dt);
    if (landT > 0) landT = Math.max(0, landT - dt);
    if (springT > 0) springT = Math.max(0, springT - dt * 3.2);
    if (glowT > 0) glowT = Math.max(0, glowT - dt * 1.6);
    if (ringT > 0) ringT = Math.max(0, ringT - dt * 1.8);
    if (particles.length > 0) particles = stepParticles(particles, dt);
    if (phase === "flying" && !reduced) {
      trail.unshift({ ...heroPos });
      if (trail.length > 7) trail.pop();
    } else if (phase === "ready" && trail.length > 0) {
      trail = [];
    }
    cam.shake = reduced ? 0 : cam.shake * 0.86;

    // 镜头平滑跟到角色身上
    const follow = reduced ? 1 : Math.min(1, dt * 6);
    const target = heroAt();
    cam.x += (target.x - cam.x) * follow;
    cam.z += (target.z + 60 - cam.z) * follow;
  }

  // ---- 画 ----
  function draw(): void {
    if (!ctx) return;
    const dpr = canvas.width / Math.max(1, cam.w);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 天空跳台世界:时段查表(无尽每 20 跳白天→黄昏→星夜),三段渐变到地面色
    const theme = skyTheme(run.hops, Boolean(opts.ramp));
    const hy = cam.h * (cam.horizon ?? 0.74);
    const sky = ctx.createLinearGradient(0, 0, 0, cam.h);
    sky.addColorStop(0, theme.top);
    sky.addColorStop(Math.min(1, Math.max(0.05, hy / cam.h)), theme.horizon);
    sky.addColorStop(1, theme.ground);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cam.w, cam.h);

    // 星夜:洒一把定在原地的小星星(不闪不飘,reduced 也不吵)
    for (let i = 0; i < theme.stars; i++) {
      const fx = ((i * 97 + 31) % 100) / 100;
      const fy = ((i * 57 + 13) % 100) / 100;
      drawStar(ctx, fx * cam.w, fy * hy * 0.8, 2.4, "#FFF2C0");
    }

    // 远景(视差 0.2):远山剪影一条 + 三朵大云
    const drift = reduced ? 0 : (cam.z + cam.x * 0.5) * cam.scale * 0.2;
    drawHills(ctx, cam.w, hy, theme.hill, drift);
    const span = cam.w + 200;
    for (let i = 0; i < 3; i++) {
      const cx = (((((i * span) / 3 + 50 - drift) % span) + span) % span) - 100;
      drawCloudPuff(ctx, cx, hy - (0.34 + 0.16 * (i % 2)) * hy, (15 + (i % 3) * 5) * Math.min(1.6, cam.scale + 0.4), theme.cloud);
    }
    // 再添两团半透明高云,高度与相位都错开,长局上半屏不显空(不成排)
    for (let i = 0; i < 2; i++) {
      const cx = ((((((i + 0.5) * span) / 2 + 130 - drift) % span) + span) % span) - 100;
      ctx.globalAlpha = 0.5 + i * 0.1;
      drawCloudPuff(ctx, cx, hy - (0.26 + 0.32 * i) * hy, (17 + i * 5) * Math.min(1.6, cam.scale + 0.4), theme.cloud);
      ctx.globalAlpha = 1;
    }

    // 中景(视差 0.5):两块漂浮小岛剪影
    const drift2 = reduced ? 0 : (cam.z + cam.x * 0.5) * cam.scale * 0.5;
    const span2 = cam.w + 260;
    for (let i = 0; i < 2; i++) {
      const cx = (((((i * span2) / 2 + 130 - drift2) % span2) + span2) % span2) - 130;
      drawIsland(ctx, cx, hy - (0.14 + 0.1 * i) * hy, (20 + i * 8) * Math.min(1.5, cam.scale + 0.3), theme.island);
    }

    // 远处的台子先画,近处的后画,自然叠出前后关系;顶出画面的直接不画
    const from = Math.max(0, run.index - 1);
    const to = Math.min(run.pads.length - 1, run.index + 4);
    for (let i = to; i >= from; i--) {
      if (!born.has(i)) born.set(i, clock);
      const snap = padTick(run.pads[i], clock);
      if (project(cam, snap.x, snap.z).sy < -10) continue;
      drawPad(ctx, cam, snap, {
        target: i === run.index + 1,
        fog: fogAlpha(snap.z - cam.z),
        fogColor: theme.horizon,
        entry: reduced ? 1 : clamp01((clock - (born.get(i) ?? clock)) / 0.45),
        glow: i === glowIdx ? glowT : 0,
        standing: i === run.index && (phase === "ready" || phase === "charging"),
        spring: i === springIdx ? springT : 0,
      });
    }

    // 训练关的落点辅助圆:告诉你现在松手会落在哪儿
    if (opts.assist && phase === "charging") {
      const cur = padTick(run.pads[run.index], clock);
      const hit = landPoint(cur, power(), aimYaw({ ...run, time: clock }));
      const p = project(cam, hit.x, hit.z, 0);
      ctx.strokeStyle = "#E2703A";
      ctx.lineWidth = 3;
      ellipse(ctx, p.sx, p.sy, 14 * cam.scale, 14 * cam.scale * DEPTH_SQUASH);
      ctx.stroke();
    }

    if (dust > 0) {
      const g = project(cam, heroPos.x, heroPos.z, 0);
      ctx.fillStyle = `rgba(214,180,150,${0.4 * dust})`;
      ellipse(ctx, g.sx, g.sy, 30 * cam.scale * (1.4 - dust), 12 * cam.scale * (1.4 - dust));
      ctx.fill();
    }

    // 完美落点:一圈金色扩散环从落点荡开
    if (ringT > 0) {
      const rp = project(cam, ringAt.x, ringAt.z, 0);
      const rr = (16 + (1 - ringT) * 46) * cam.scale;
      ctx.strokeStyle = `rgba(255,199,88,${0.85 * ringT})`;
      ctx.lineWidth = 3;
      ellipse(ctx, rp.sx, rp.sy, rr, rr * DEPTH_SQUASH);
      ctx.stroke();
    }

    if (phase !== "over") {
      const squash = phase === "charging" && !reduced ? power() * 0.85 : 0;
      const pose: HeroPose =
        phase === "charging"
          ? "charge"
          : phase === "flying"
            ? "fly"
            : phase === "falling"
              ? "fall"
              : landT > 0
                ? "land"
                : "idle";
      drawHero(ctx, cam, heroAt(), squash, heroColor, {
        variant: heroVariant,
        pose,
        crown: run.combo >= 3,
        reduced,
        t: clock,
        trail,
      });
    }

    if (phase === "falling" || phase === "over") {
      // 睡眼救援云:接住人的那一下弹性下沉再回弹(reduced 不沉)
      const g = project(cam, heroPos.x, heroPos.z, 0);
      const catchT = phase === "over" ? 1 : clamp01((fallT - (FALL_TIME - 0.3)) / 0.3);
      const sink = reduced ? 0 : Math.sin(Math.min(1, catchT) * Math.PI) * 6;
      drawRescueCloud(ctx, g.sx, Math.min(cam.h - 40, g.sy + 70), 26 * cam.scale, sink);
    }

    if (particles.length > 0) drawParticles(ctx, particles);

    // 蓄力力度环:跟着角色脚下走,颜色绿→金→红;窄屏或 reduced 靠底部旧条(无障碍备份)
    if (phase === "charging" && !reduced && cam.w >= 380) {
      const g = project(cam, heroPos.x, heroPos.z, 0);
      drawChargeRing(ctx, g.sx, g.sy + 6, 27 * cam.scale, power());
    }

    drawChargeBar(ctx);

    if (flashT > 0 && flashText) {
      // 闪话的墨色跟着时段走:星夜换奶白,别让字沉进夜里
      ctx.fillStyle = theme.ink;
      ctx.font = `900 ${Math.round(15 + 3 * cam.scale)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(flashText, cam.w / 2, cam.h * 0.16);
    }

    if (paused && !over) {
      ctx.fillStyle = "rgba(255,248,242,.9)";
      ctx.fillRect(0, 0, cam.w, cam.h);
      const titlePx = Math.round(18 + 3 * cam.scale);
      // 暂停 emoji 换画制:标题上方一枚双圆角竖条暂停牌(round2 遗留 #6)
      drawPauseBars(ctx, cam.w / 2, cam.h / 2 - 14 - titlePx * 1.5, titlePx * 0.9);
      ctx.fillStyle = "#9A5A2C";
      ctx.font = `900 ${titlePx}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("已暂停", cam.w / 2, cam.h / 2 - 14);
      ctx.font = `700 ${Math.round(14 + 2 * cam.scale)}px system-ui`;
      ctx.fillText("再按一次 Esc 继续", cam.w / 2, cam.h / 2 + 16);
    }
  }

  /** 底部蓄力条:≥12px 高,360px 上也一眼看得清 */
  function drawChargeBar(ctx2: Ctx): void {
    const h = CHARGE_BAR_H;
    const pad = 14;
    const y = cam.h - h - 12;
    const w = cam.w - pad * 2;
    ctx2.fillStyle = "rgba(255,255,255,.8)";
    ctx2.fillRect(pad, y, w, h);
    // 满力之后换一档更亮的颜色顶住,让「再按也不会更远」这件事一直看得见
    ctx2.fillStyle = isFull() ? FULL_BAR_COLOR : "#F2A268";
    ctx2.fillRect(pad, y, w * clamp01(power()), h);
    // 训练关才给刻度:标出正好够到下一座台心的那个力度,别的关自己找手感
    if (opts.assist) {
      const need = clamp01(requiredPower({ ...run, time: clock }));
      ctx2.fillStyle = "#B4437B";
      ctx2.fillRect(pad + w * need - 2, y - 4, 4, h + 8);
    }
  }

  // ---- HUD ----
  function refreshHud(): void {
    const goalText = Number.isFinite(goal) ? ` / ${goal}` : "";
    hudL.textContent = `⭕ ${run.hops}${goalText} 座 · ${run.score} 分`;
    hudR.textContent = opts.info ? opts.info() : run.combo > 1 ? `🔥 ${run.combo} 连` : "";
    // 画布本身给读屏软件念一句现状,顺带让浏览器冒烟脚本读得到内部状态
    canvas.setAttribute(
      "aria-label",
      `${opts.name ? `${opts.name},` : ""}站住 ${run.hops} 座,${run.score} 分,连击 ${run.combo}${
        isFull() ? ",力度已经满了" : ""
      }${paused ? ",已暂停" : ""}`
    );
    canvas.setAttribute("data-hops", String(run.hops));
    canvas.setAttribute("data-score", String(run.score));
    canvas.setAttribute("data-combo", String(run.combo));
    canvas.setAttribute("data-phase", phase);
    canvas.setAttribute("data-paused", paused ? "1" : "0");
    canvas.setAttribute("data-full", isFull() ? "1" : "0");
    // 画面上闪的那句话也挂成属性:不读画布像素也量得到(指路提示就靠它验)
    canvas.setAttribute("data-flash", flashT > 0 ? flashText : "");
  }

  // ---- 主循环 ----
  let raf = 0;
  let last = 0;
  function frame(ts: number): void {
    raf = requestAnimationFrame(frame);
    const now = typeof ts === "number" ? ts : 0;
    const dt = last === 0 ? 0.016 : Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused && !frozen) step(dt);
    draw();
    refreshHud();
  }
  raf = requestAnimationFrame(frame);

  // ---- 输入:整块画面都能按 ----
  //
  // 双人同屏是两块 stage 各挂一份 window 监听,所以「抬手」必须认得出是谁的手指:
  // 不对账的话,一个人松手会把两个人一起弹出去(蓄力时长根本不由自己决定)。
  // pointer 事件用 pointerId,touch 事件用 changedTouches[].identifier;
  // 同一次按下往往两种事件都会来一遍,所以本台按下时收到的手指号全记进账本,谁的号回来就放谁。
  const touchIdsOf = (ev: PointerLikeEvent): string[] => {
    const out: string[] = [];
    const list = ev.changedTouches;
    if (list) {
      for (let i = 0; i < list.length; i++) {
        const id = list[i]?.identifier;
        if (typeof id === "number") out.push(`t${id}`);
      }
    }
    if (typeof ev.pointerId === "number") out.push(`p${ev.pointerId}`);
    return out;
  };
  /** 本台正按着屏幕的那根(些)手指;空集合表示这一台没人按着屏幕 */
  const heldTouches = new Set<string>();
  let heldByTouch = false;

  const onDown = (ev: PointerLikeEvent): void => {
    ev.preventDefault?.();
    heldByTouch = true;
    for (const id of touchIdsOf(ev)) heldTouches.add(id);
    press();
  };
  const onUp = (ev: PointerLikeEvent): void => {
    // 没按过屏幕就不关这一台的事(键盘那一路走 onKeyUp)
    if (!heldByTouch) return;
    const ids = touchIdsOf(ev);
    // 认得出手指号、又不是本台按下的那根,就是隔壁那个人在抬手
    if (ids.length > 0 && heldTouches.size > 0 && !ids.some((id) => heldTouches.has(id))) return;
    heldByTouch = false;
    heldTouches.clear();
    if (phase === "charging") release();
  };
  const onKeyDown = (ev: { key?: string; repeat?: boolean; preventDefault?: () => void }): void => {
    const k = (ev.key ?? "").toLowerCase();
    if (k === "escape") {
      if (over || frozen) return;
      ev.preventDefault?.();
      paused = !paused;
      if (paused && phase === "charging") phase = "ready";
      return;
    }
    if (cancelKeys.includes(k)) {
      ev.preventDefault?.();
      if (ev.repeat) return;
      cancelCharge();
      return;
    }
    // 方向键 / WASD 只指路,不接语义:phase 一动不动,这一跳的判定也一点不受影响
    if (!keys.includes(k) && (IDLE_KEYS as readonly string[]).includes(k)) {
      if (ev.repeat || over || paused) return;
      flashText = hintLine;
      flashT = 1.4;
      return;
    }
    if (!keys.includes(k)) return;
    ev.preventDefault?.();
    if (ev.repeat) return;
    press();
  };
  const onKeyUp = (ev: { key?: string }): void => {
    const k = (ev.key ?? "").toLowerCase();
    if (!keys.includes(k)) return;
    if (phase === "charging") release();
  };

  hot.addEventListener("pointerdown", onDown as EventListener);
  hot.addEventListener("touchstart", onDown as EventListener);
  const win = globalThis as unknown as {
    addEventListener: (t: string, f: unknown) => void;
    removeEventListener: (t: string, f: unknown) => void;
  };
  win.addEventListener("pointerup", onUp);
  win.addEventListener("pointercancel", onUp);
  win.addEventListener("touchend", onUp);
  win.addEventListener("keydown", onKeyDown);
  win.addEventListener("keyup", onKeyUp);
  win.addEventListener("resize", resize);

  return {
    root,
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(fitTimer);
      hot.removeEventListener("pointerdown", onDown as EventListener);
      hot.removeEventListener("touchstart", onDown as EventListener);
      win.removeEventListener("pointerup", onUp);
      win.removeEventListener("pointercancel", onUp);
      win.removeEventListener("touchend", onUp);
      win.removeEventListener("keydown", onKeyDown);
      win.removeEventListener("keyup", onKeyUp);
      win.removeEventListener("resize", resize);
      root.remove();
    },
    press,
    release,
    cancel: cancelCharge,
    full: isFull,
    flash: () => (flashT > 0 ? flashText : ""),
    phase: () => phase,
    state: () => run,
    camera: () => cam,
    fx: () => ({ particles: particles.length, ring: ringT, glow: glowT, crown: run.combo >= 3, spring: springT }),
    setPaused: (v: boolean) => {
      paused = v;
    },
    tick: (ms: number) => {
      const dt = ms / 1000;
      let left = dt;
      while (left > 0) {
        const slice = Math.min(0.032, left);
        if (!paused && !frozen) step(slice);
        left -= slice;
      }
      draw();
      refreshHud();
    },
  };
}

// ---------------------------------------------------------------------------
// 外壳:返回键 + 标题 + 一块舞台 + 一行说明
// ---------------------------------------------------------------------------

interface Shell {
  wrap: HTMLElement;
  chip: HTMLElement;
  body: HTMLElement;
  say: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void, title: string): Shell {
  const wrap = document.createElement("div");
  wrap.className = "hp-shell";
  const top = document.createElement("div");
  top.className = "hp-shelltop";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "hp-back";
  back.textContent = "← 返回";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = document.createElement("div");
  chip.className = "hp-chip";
  chip.textContent = title;
  top.append(back, chip);
  const body = document.createElement("div");
  const say = document.createElement("div");
  say.className = "hp-say";
  wrap.append(top, body, say);
  host.appendChild(wrap);
  return {
    wrap,
    chip,
    body,
    say,
    destroy() {
      wrap.remove();
    },
  };
}

/** 从训练壳量舞台余量,再按块钳双人画布高 */
function duoPaneHeightFromShell(shell: Shell): number {
  const wrap = shell.wrap;
  let room = Number.NaN;
  if (typeof wrap.getBoundingClientRect === "function") {
    let node: HTMLElement | null = wrap.parentElement;
    for (let i = 0; node && i < 12; i++) {
      const cls = typeof node.className === "string" ? node.className : "";
      if (cls.includes("game-stage")) {
        if (typeof node.getBoundingClientRect !== "function") break;
        const r = node.getBoundingClientRect();
        const inner =
          typeof node.clientHeight === "number" && node.clientHeight > 0
            ? (node.clientTop || 0) + node.clientHeight
            : r.height;
        const top = wrap.getBoundingClientRect().top;
        if (Number.isFinite(r.top) && Number.isFinite(inner) && inner > 0 && Number.isFinite(top)) {
          room = r.top + inner - top;
        }
        break;
      }
      node = node.parentElement;
    }
  }
  const topEl = wrap.querySelector(".hp-shelltop") as HTMLElement | null;
  const topH =
    topEl && typeof topEl.getBoundingClientRect === "function"
      ? topEl.getBoundingClientRect().height
      : (topEl?.offsetHeight ?? 44);
  const sayH =
    typeof shell.say.getBoundingClientRect === "function"
      ? shell.say.getBoundingClientRect().height
      : (shell.say.offsetHeight ?? 22);
  const chrome = Math.max(0, topH) + Math.max(0, sayH) + 20;
  return duoPaneHeightPx(room, chrome);
}

/** 结算卡要画谁、画什么数:跳数 + 完美率进度环 + 最远台数;双人两角色并排 */
export interface ResultViz {
  heroes: Array<{ color: string; variant: HeroVariant; win?: boolean }>;
  hops: number;
  perfects: number;
  far: number;
}

/** 结算卡:左边角色(胜者跳起庆祝),右边完美率进度环,顶上一行跳数与最远台数 */
export function drawResultCard(ctx: Ctx, viz: ResultViz, w = 250, h = 116): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#FFF8EE";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#7C6350";
  // 宪法下限 14px(visual-r3 修 N-R3-01):结算卡统计行原 12px;卡宽 250,整行 ~200px 放得下
  ctx.font = "700 14px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`站住 ${viz.hops} 座 · 最远第 ${viz.far} 座`, 12, 18, 226);

  const ratio = viz.hops > 0 ? viz.perfects / viz.hops : 0;
  drawProgressRing(ctx, w - 44, h / 2 + 4, 24, ratio, "#F2A268");
  ctx.fillStyle = "#9A5A2C";
  ctx.font = "900 14px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(ratio * 100)}%`, w - 44, h / 2 + 4);
  // 宪法下限 14px(visual-r3 修 N-R3-01):「完美率」注脚原 11px
  ctx.font = "700 14px system-ui";
  ctx.fillText("完美率", w - 44, h - 10);

  viz.heroes.forEach((hero, i) => {
    const solo = viz.heroes.length === 1;
    const hx = solo ? 52 : 42 + i * 64;
    const win = hero.win ?? solo;
    const hy = h - 22 - (win ? 16 : 0);
    ctx.fillStyle = "rgba(120,90,70,.18)";
    ellipse(ctx, hx, h - 16, 20, 7);
    ctx.fill();
    drawHeroSprite(ctx, {
      x: hx,
      y: hy,
      rx: 17,
      ry: 13.5,
      color: hero.color,
      variant: hero.variant,
      pose: win ? "fly" : "land",
      crown: win && !solo,
      t: 1,
    });
  });
}

/** 一块结算浮层(带 viz 就画结算卡) */
function overPanel(
  host: HTMLElement,
  title: string,
  sub: string,
  label: string,
  onAgain: () => void,
  viz?: ResultViz
): HTMLElement {
  const box = document.createElement("div");
  box.className = "hp-over";
  const t = document.createElement("div");
  t.className = "hp-over-t";
  t.textContent = title;
  box.appendChild(t);
  if (viz) {
    const cv = document.createElement("canvas") as HTMLCanvasElement;
    cv.className = "hp-result-cv";
    cv.width = 250;
    cv.height = 116;
    const c2 = cv.getContext("2d") as Ctx | null;
    if (c2) drawResultCard(c2, viz);
    box.appendChild(cv);
  }
  const s = document.createElement("div");
  s.className = "hp-over-s";
  s.textContent = sub;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hp-open";
  btn.textContent = label;
  btn.addEventListener("click", onAgain);
  box.append(s, btn);
  host.appendChild(box);
  return box;
}

// ---------------------------------------------------------------------------
// 闯关:188 关
// ---------------------------------------------------------------------------

function playLevel(stageHost: HTMLElement, ctx: PlayCtx): PlayHandle {
  const lv: HopLevel = buildLevel(ctx.level);
  const box = document.createElement("div");
  const tip = document.createElement("div");
  tip.className = "hp-tip";
  tip.textContent = `${lv.hint}${lv.assist ? " · 蓄力时会画出落点辅助圆" : ""}`;
  const say = document.createElement("div");
  say.className = "hp-say";
  say.textContent = "按住屏幕(或空格 / F)蓄力,松手起跳;蓄力条变色就是满力了,蓄过头按 G 收力,Esc 暂停。";
  box.append(tip, say);
  stageHost.appendChild(box);

  let settled = false;
  const stage = createStage(box, {
    seed: lv.seed,
    difficulty: lv.difficulty,
    goal: lv.goal,
    assist: lv.assist,
    sfx: (n) => ctx.sfx(n),
    onHop: (res, run) => {
      if (res.verdict === "perfect") say.textContent = `踩中圆心!连击 ${run.combo}`;
      else say.textContent = "站住了,连击重新数,下一跳往中间收一点。";
      say.className = "hp-say";
    },
    onGoal: (run) => {
      if (settled) return;
      settled = true;
      const res = { cleared: run.hops, perfects: run.perfects, score: run.score, bestCombo: run.bestCombo };
      const stars = levelStars(lv, res);
      ctx.win(stars, winLine(lv, res, stars));
    },
    onOver: (run) => {
      if (settled) return;
      settled = true;
      const res = { cleared: run.hops, perfects: run.perfects, score: run.score, bestCombo: run.bestCombo };
      if (levelPassed(lv, res)) {
        const stars = levelStars(lv, res);
        ctx.win(stars, winLine(lv, res, stars));
      } else {
        ctx.lose(loseLine(lv, res));
      }
    },
  });

  return {
    destroy() {
      stage.destroy();
      box.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽:一直跳下去,记最高分
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "♾️ 无尽跳");
  let best = save.getGameProgress(meta.id).endlessBest;
  let stage: Stage | null = null;
  let panel: HTMLElement | null = null;

  function start(): void {
    stage?.destroy();
    panel?.remove();
    panel = null;
    shell.chip.textContent = `♾️ 无尽跳 · 最好 ${best} 分`;
    shell.say.textContent = "按住任意位置蓄力,松手起跳;蓄过头按 G 收力。台子会越来越小,慢慢来。";
    shell.say.className = "hp-say";
    stage = createStage(shell.body, {
      seed: (Date.now() % 1_000_000) + 17,
      difficulty: endlessDifficulty(0),
      ramp: endlessDifficulty,
      sfx: (n) => api.play(n),
      info: () => `最好 ${best} 分`,
      onHop: (res, run) => {
        if (res.verdict === "perfect" && run.combo > 0 && run.combo % 5 === 0) api.addStars(1);
      },
      onOver: (run) => {
        best = save.recordEndlessBest(meta.id, run.score);
        shell.say.textContent = `${CATCH_LINE}。`;
        shell.say.className = "hp-say hp-say-oops";
        panel = overPanel(
          stage!.root,
          "☁️ 云朵接住你啦",
          `这一局站住 ${run.hops} 座,拿了 ${run.score} 分,最高连击 ${run.bestCombo}。历史最好 ${best} 分。`,
          "🔁 再来一次",
          () => {
            api.play("tap");
            start();
          },
          { heroes: [{ color: "#F2A268", variant: "duo" }], hops: run.hops, perfects: run.perfects, far: run.index }
        );
      },
    });
  }

  start();
  return {
    destroy() {
      stage?.destroy();
      stage = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 对战:和幽灵跑同一条台序比分
// ---------------------------------------------------------------------------

/**
 * 对战一局站满多少座。
 * 玩家看 `run.hops >= goal`、幽灵看 `playGhost(..., MATCH_HOPS)`,两边数的是同一件事:
 * **站住的座数**(弹簧台白送的那一跳两边都算)。
 */
export const MATCH_HOPS = 16;

function mountVersus(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "⚔️ 幽灵对战");
  let tier: AiTier = "normal";
  let round = 1;
  const wins = [0, 0];
  let stage: Stage | null = null;
  let panel: HTMLElement | null = null;

  function pickPanel(): void {
    stage?.destroy();
    stage = null;
    panel?.remove();
    panel = null;
    shell.body.innerHTML = "";
    shell.chip.textContent = "⚔️ 幽灵对战 · 挑一个对手";
    shell.say.textContent = "你和幽灵跑同一条台序,谁的分高谁赢。";
    const box = document.createElement("div");
    box.className = "hp-bar";
    for (const t of ["rookie", "normal", "expert", "hell"] as AiTier[]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `hp-open${tier === t ? "" : " hp-open-vs"}`;
      b.textContent = `${TIER_FACES[t]} ${TIER_NAMES[t]}`;
      b.addEventListener("click", () => {
        api.play("tap");
        tier = t;
        pickPanel();
      });
      box.appendChild(b);
    }
    const go = document.createElement("button");
    go.type = "button";
    go.className = "hp-open";
    go.textContent = "开跳 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      startRound();
    });
    shell.body.append(box, go);
  }

  function startRound(): void {
    stage?.destroy();
    panel?.remove();
    panel = null;
    shell.body.innerHTML = "";
    const seed = matchSeed(round);
    const diff = matchDifficulty(round);
    const ghost: GhostRun = playGhost(seed, diff, tier, MATCH_HOPS);
    shell.chip.textContent = `⚔️ 第 ${round} 局 · 你 ${wins[0]} : ${wins[1]} ${TIER_NAMES[tier]}`;
    shell.say.textContent = `${TIER_FACES[tier]} ${TIER_NAMES[tier]}幽灵在这条台序上拿了 ${ghost.score} 分,轮到你了。`;
    shell.say.className = "hp-say";

    let done = false;
    function finish(run: RunState): void {
      if (done) return;
      done = true;
      const iWin = run.score > ghost.score;
      if (iWin) {
        wins[0]++;
        api.addStars(1);
      } else if (run.score < ghost.score) {
        wins[1]++;
      }
      panel = overPanel(
        stage!.root,
        iWin ? "🏆 这一局你赢了!" : run.score === ghost.score ? "🤝 打成平手" : "☁️ 云朵接住你啦",
        ghostLine(tier, ghost, run.score),
        "🔁 再来一局",
        () => {
          api.play("tap");
          round++;
          startRound();
        },
        { heroes: [{ color: "#F2A268", variant: "duo", win: iWin }], hops: run.hops, perfects: run.perfects, far: run.index }
      );
    }

    stage = createStage(shell.body, {
      seed,
      difficulty: diff,
      goal: MATCH_HOPS,
      sfx: (n) => api.play(n),
      info: () => `${TIER_FACES[tier]} ${ghost.score} 分`,
      onGoal: finish,
      onOver: finish,
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
// 双人同屏:上下分屏,朵朵 F / 星星 L
// ---------------------------------------------------------------------------

/** 双人一局跳多少座 */
export const DUO_HOPS = 14;

function mountTwoPlayer(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "👫 双人同屏");
  let round = 1;
  const wins = [0, 0];
  let stages: Stage[] = [];
  let panel: HTMLElement | null = null;

  function startRound(): void {
    for (const s of stages) s.destroy();
    stages = [];
    panel?.remove();
    panel = null;
    shell.body.innerHTML = "";
    shell.chip.textContent = `👫 第 ${round} 局 · 朵朵 ${wins[0]} : ${wins[1]} 星星`;
    shell.say.textContent =
      "上半屏是朵朵,按 F 或按住上半块屏幕;下半屏是星星,按 L 或按住下半块。蓄过头:朵朵按 G、星星按 K 收力。";
    shell.say.className = "hp-say";

    const seed = matchSeed(round + 500);
    const diff = matchDifficulty(round);
    const done = [false, false];
    const scores = [0, 0];
    const runs: Array<RunState | null> = [null, null];

    function maybeSettle(): void {
      if (!done[0] || !done[1]) return;
      const line =
        scores[0] === scores[1]
          ? `${scores[0]} 比 ${scores[1]},平手!再来一局。`
          : scores[0] > scores[1]
            ? `朵朵 ${scores[0]} 分,星星 ${scores[1]} 分,这一局朵朵赢。`
            : `星星 ${scores[1]} 分,朵朵 ${scores[0]} 分,这一局星星赢。`;
      if (scores[0] > scores[1]) wins[0]++;
      else if (scores[1] > scores[0]) wins[1]++;
      api.addStars(1);
      panel = overPanel(
        stages[0]?.root ?? shell.body,
        "🏁 这一局结束",
        `${line} 总比分 朵朵 ${wins[0]} : ${wins[1]} 星星。`,
        "🔁 再来一局",
        () => {
          api.play("tap");
          round++;
          startRound();
        },
        {
          heroes: [
            { color: "#F2A268", variant: "duo", win: scores[0] > scores[1] },
            { color: "#7FA7EA", variant: "star", win: scores[1] > scores[0] },
          ],
          hops: (runs[0]?.hops ?? 0) + (runs[1]?.hops ?? 0),
          perfects: (runs[0]?.perfects ?? 0) + (runs[1]?.perfects ?? 0),
          far: Math.max(runs[0]?.index ?? 0, runs[1]?.index ?? 0),
        }
      );
    }

    const wrap = document.createElement("div");
    wrap.className = "hp-duo";
    shell.body.appendChild(wrap);

    const seats: Array<{ name: string; keys: string[]; cancelKeys: string[]; color: string; variant: HeroVariant }> = [
      { name: "🌸 朵朵 · F", keys: ["f"], cancelKeys: ["g"], color: "#F2A268", variant: "duo" },
      { name: "⭐ 星星 · L", keys: ["l"], cancelKeys: ["k"], color: "#7FA7EA", variant: "star" },
    ];
    seats.forEach((seat, i) => {
      const st = createStage(wrap, {
        seed,
        difficulty: diff,
        goal: DUO_HOPS,
        keys: seat.keys,
        cancelKeys: seat.cancelKeys,
        name: seat.name,
        color: seat.color,
        variant: seat.variant,
        height: duoPaneHeightFromShell(shell),
        sfx: (n) => api.play(n),
        onGoal: (run) => {
          if (done[i]) return;
          done[i] = true;
          scores[i] = run.score;
          runs[i] = run;
          maybeSettle();
        },
        onOver: (run) => {
          if (done[i]) return;
          done[i] = true;
          scores[i] = run.score;
          runs[i] = run;
          maybeSettle();
        },
      });
      stages.push(st);
    });
  }

  startRound();
  return {
    destroy() {
      for (const s of stages) s.destroy();
      stages = [];
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  root.className = "hp-wrap";
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "hp-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "hp-open";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "hp-open hp-open-vs";
  vsBtn.textContent = "⚔️ 幽灵对战";
  const duoBtn = document.createElement("button");
  duoBtn.type = "button";
  duoBtn.className = "hp-open hp-open-duo";
  duoBtn.textContent = "👫 双人同屏";
  bar.append(endlessBtn, vsBtn, duoBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽跳 · 最好 ${best} 分` : "♾️ 无尽跳 · 点我开始!";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
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
      // 关内把模式入口收起来:手机上这一条要占约 96px,跳台能整个抬进首屏
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const h = playLevel(stage, ctx);
        return {
          destroy() {
            h?.destroy?.();
            bar.hidden = false;
          }
        };
      },
      mapHint: `按住蓄力、松手起跳,踩中${KIND_NAMES.steady}中间的圆心才算完美。掉下去有云朵接着,不怕。`,
      grandMessage: "188 关全部跳完,你就是跳跳台上最稳的那一个!",
      guide: guideBook,
      guideTitle: "跳跳台 · 手感手记",
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    },
  };
}
