/**
 * 便便超人 · 1.3 视觉常量与纯函数(第 22 步 C 档,只动皮不动骨)。
 *
 * 这里集中放:四·补一的配色板 token、四·补三的动效时序、图层序清单、
 * 超人三态姿势 / 腿摆相位 / 呼吸 / 细节降级 / 章节主题映射 / 变花展开帧,
 * 以及冲刺残影 / 星星尾流 / 接触星花的粒子管理(`destroy` 一把归零)。
 *
 * 判定盒(`PLAYER_W/H`、`CROUCH_H`)、扫除窗口(`sweepT`/`dashT`)、豆豆怪行为、
 * 章节数据在这儿**只读不写**——一个玩法数值都不许从这里改。
 */

import { SparklePool } from "../../art/kit/sparkle";

// ---------------------------------------------------------------------------
// 配色板(四·补一):统一光源左上 45°,粉彩不搞脏
// ---------------------------------------------------------------------------

/** 加深(pct<0)或提亮(pct>0)一个 #RRGGBB 颜色,pct 按百分比算 */
export function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number): number => {
    const target = pct >= 0 ? 255 : 0;
    const k = Math.min(1, Math.abs(pct) / 100);
    return Math.round(v + (target - v) * k);
  };
  const r = mix((n >> 16) & 0xff);
  const g = mix((n >> 8) & 0xff);
  const b = mix(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0").toUpperCase()}`;
}

/** 视觉 token(四·补一表,值不许跑偏,用例钉死) */
export const PH_TOKENS = {
  /** 披风外层渐变两端:主色顶亮 → 底暗 */
  phCapeOut: "#F4859F",
  phCapeOutDeep: shade("#F4859F", -18),
  /** 披风内衬 */
  phCapeIn: "#FFE9F2",
  /** 身体主色(胸口高光 +25%) */
  phSuit: "#7FB2F0",
  phSuitHi: shade("#7FB2F0", 25),
  /** 腰带 + 圆扣 */
  phBelt: "#F0C25A",
  phBeltBuckle: shade("#F0C25A", 30),
  /** 扫帚木柄(捆环金色) */
  phBroom: "#C89B6C",
  phBroomRing: "#F3CC7C",
  /** 扫过区域发亮干净带 */
  phClean: "rgba(255,244,200,.25)",
  /** 统一落影 */
  phShadow: "rgba(90,74,110,.16)",
} as const;

/**
 * 两位小主角的 1.3 视觉套装:朵朵粉披风蓝衣、星星蓝披风粉衣。
 * 粉彩原创撞色,和超人 / 蝙蝠侠 / 奥特曼的标志配色组合零相似(无 S 徽章、无红蓝撞色)。
 *
 * R1 修复(A-9 双人 16px 灰度可分):星星披风从 #7FA9F0 加深到 #6690E0,
 * 两人披风的 Rec.601 灰阶差从 Δ4 拉开到 Δ≈29(≥25 可辨阈值);
 * 再配 drawHero 里星星的剪影级星星发卡,灰度下有「亮度 + 轮廓」两条可靠通道。
 */
export const HERO_VIS = [
  {
    name: "朵朵",
    skin: "#FFD9A8",
    hair: "#C98A52",
    capeOut0: PH_TOKENS.phCapeOut,
    capeOut1: PH_TOKENS.phCapeOutDeep,
    capeIn: PH_TOKENS.phCapeIn,
    suit: PH_TOKENS.phSuit,
    suitHi: PH_TOKENS.phSuitHi,
    mask: "#7B4DA8",
    glove: "#FFF4E0",
    boot: shade(PH_TOKENS.phCapeOut, -10),
  },
  {
    name: "星星",
    skin: "#FFE2BE",
    hair: "#8A6A4A",
    capeOut0: "#6690E0",
    capeOut1: shade("#6690E0", -18),
    capeIn: "#E9F2FF",
    suit: "#F490AC",
    suitHi: shade("#F490AC", 25),
    mask: "#2F6BAE",
    glove: "#FFF4E0",
    boot: shade("#6690E0", -10),
  },
] as const;

/**
 * 「豆豆怪」的粉彩配色:一章一套,全是浅浅的糖果色(1.2 原值原样搬入,一个不改)。
 * 造型统一成圆润的小豆豆 + 大眼睛 + 微笑,**一点棕色写实都不要**。
 */
export const BEAN_COLORS = [
  { body: "#FFC9DE", shade: "#F7A8C6", face: "#B4577E" },
  { body: "#C9E7C0", shade: "#A9D6A0", face: "#4F8258" },
  { body: "#C6DCF7", shade: "#A6C4E8", face: "#3F6C9E" },
  { body: "#FFE0AE", shade: "#F6CB86", face: "#A9782C" },
  { body: "#F6C6EA", shade: "#E7A6D6", face: "#9B4E86" },
  { body: "#BFE6F2", shade: "#9CD2E4", face: "#3C7C92" },
  { body: "#FFF0B0", shade: "#F3DE86", face: "#9C8320" },
  { body: "#DACDF6", shade: "#C0AEE8", face: "#6A4FA8" },
] as const;

/** 自绘五瓣花的五套配色,顶替原来的 emoji `FLOWERS[]` 那五朵 */
export const FLOWER_STYLES = [
  { petal: "#FFB7CF", petalDeep: "#F98BB2", heart0: "#FFF3C9", heart1: "#F5C95E" },
  { petal: "#FFF1B8", petalDeep: "#F5D876", heart0: "#FFFDF2", heart1: "#EFA93C" },
  { petal: "#F6B6E5", petalDeep: "#E38BD0", heart0: "#FFF0FA", heart1: "#C95BAA" },
  { petal: "#FFD37E", petalDeep: "#F2AE4B", heart0: "#FFF6DC", heart1: "#B97A2A" },
  { petal: "#C9BCF2", petalDeep: "#A98FE2", heart0: "#F6F0FF", heart1: "#7C5FC2" },
] as const;

// ---------------------------------------------------------------------------
// 动效时序(四·补三表,毫秒写死,用例引用)
// ---------------------------------------------------------------------------

export const PH_ANIM = {
  /** 站立呼吸:±1px、2000ms、sin;reduced 停 */
  breathMs: 2000,
  breathPx: 1,
  /** 跑动腿摆:4 帧循环、160ms/帧、step;reduced 2 帧简化 */
  legFrameMs: 160,
  legFrames: 4,
  legFramesReduced: 2,
  /** 冲刺残影:两帧渐隐、linear;reduced 不生成 */
  dashGhostFrames: 2,
  /** 星星尾流:3 颗、300ms、ease-out;reduced 不生成 */
  trailStars: 3,
  trailMs: 300,
  /** 变花展开:3 帧、共 240ms、step;reduced 一帧 */
  bloomFrames: 3,
  bloomMs: 240,
  /** 徽章发光脉冲:500ms、ease-out;reduced 静态亮徽章 */
  badgePulseMs: 500,
  /** 细节降级阈值:刘海 / 腰带扣低于 5px 省略 */
  detailMinPx: 5,
  /** 奔跑前倾 10°、冲刺前倾 18°(弧度) */
  leanRun: (10 * Math.PI) / 180,
  leanDash: (18 * Math.PI) / 180,
} as const;

/**
 * 图层序(render 从底到顶),残影永远画在超人身后一层。
 * render() 里的分段注释按这份清单走,用例钉顺序。
 */
export const PH_LAYERS = [
  "章节背景两层视差",
  "地面+干净带",
  "豆豆怪",
  "扫帚残影",
  "超人",
  "星星尾流/星花",
  "HUD",
] as const;

// ---------------------------------------------------------------------------
// 三态姿势与相位(读状态,不写状态)
// ---------------------------------------------------------------------------

export type HeroPose = "idle" | "run" | "dash";

/** 跑动姿态的速度门槛(px/s):只用来选画哪套姿势,绝不回写速度 */
export const RUN_POSE_MIN_SPEED = 30;

/** 三态分派:冲刺(dashT>0) > 跑动(|vx|≥门槛) > 站立 */
export function heroPose(p: { dashT: number; vx: number }): HeroPose {
  if (p.dashT > 0) return "dash";
  if (Math.abs(p.vx) >= RUN_POSE_MIN_SPEED) return "run";
  return "idle";
}

/** 三态前倾角(弧度):站 0 / 跑 10° / 冲 18° */
export function poseLean(pose: HeroPose): number {
  if (pose === "dash") return PH_ANIM.leanDash;
  if (pose === "run") return PH_ANIM.leanRun;
  return 0;
}

/** 跑动腿摆的帧号:4 帧 step 循环;reduced 简化成 2 帧 */
export function legFrame(timeMs: number, reduced: boolean): number {
  const frames = reduced ? PH_ANIM.legFramesReduced : PH_ANIM.legFrames;
  return Math.floor(Math.max(0, timeMs) / PH_ANIM.legFrameMs) % frames;
}

/** 站立呼吸的纵向偏移(px):sin 起伏 ±1px;reduced 恒 0 */
export function breathOffset(timeMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return Math.sin((timeMs / PH_ANIM.breathMs) * Math.PI * 2) * PH_ANIM.breathPx;
}

/** 细节降级:刘海 / 腰带扣这类小零件低于 5px 就省略,剪影优先 */
export function showDetail(px: number): boolean {
  return px >= PH_ANIM.detailMinPx;
}

export function easeOutQuad(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) * (1 - c);
}

// ---------------------------------------------------------------------------
// 扫帚残影 / 变花 / 徽章脉冲
// ---------------------------------------------------------------------------

/**
 * 扫帚弧形残影的透明度:只在 `sweepT > 0` 的窗口里出现(窗口时长本身不归这儿管)。
 * reduced 给一帧静态弧(功能反馈不能整个删掉)。
 */
export function broomTrailAlpha(sweepT: number, sweepTime: number, reduced: boolean): number {
  if (sweepT <= 0) return 0;
  if (reduced) return 0.5;
  return easeOutQuad(sweepT / sweepTime);
}

/** 变花展开帧号(0..2):240ms 内 step 走完 3 帧;reduced 直接最后一帧 */
export function bloomFrame(elapsedMs: number, reduced: boolean): number {
  const last = PH_ANIM.bloomFrames - 1;
  if (reduced) return last;
  const per = PH_ANIM.bloomMs / PH_ANIM.bloomFrames;
  return Math.min(last, Math.floor(Math.max(0, elapsedMs) / per));
}

/** 连击徽章脉冲:500ms ease-out 回落;reduced 恒定静态亮徽章 */
export function badgePulse(msSince: number, reduced: boolean): { scale: number; glow: number } {
  if (reduced) return { scale: 1, glow: 0.35 };
  if (msSince >= PH_ANIM.badgePulseMs || msSince < 0) return { scale: 1, glow: 0 };
  const k = 1 - easeOutQuad(msSince / PH_ANIM.badgePulseMs);
  return { scale: 1 + 0.22 * k, glow: 0.6 * k };
}

/**
 * 自绘五瓣花:五片渐变花瓣 + 径向渐变花心,顶替原来的 emoji `FLOWERS[]`。
 * 展开动画的帧 → 尺寸缩放由调用方拿 `bloomFrame` 算好再传 r。
 */
export function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, styleIdx: number): void {
  const n = FLOWER_STYLES.length;
  const st = FLOWER_STYLES[((styleIdx % n) + n) % n];
  ctx.save();
  ctx.translate(x, y);
  for (let k = 0; k < 5; k++) {
    ctx.save();
    ctx.rotate(-Math.PI / 2 + (k * 2 * Math.PI) / 5);
    const grad = ctx.createLinearGradient(0, 0, r, 0);
    grad.addColorStop(0, st.petal);
    grad.addColorStop(1, st.petalDeep);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(r * 0.58, 0, r * 0.46, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const heart = ctx.createRadialGradient(-r * 0.12, -r * 0.12, r * 0.05, 0, 0, r * 0.4);
  heart.addColorStop(0, st.heart0);
  heart.addColorStop(1, st.heart1);
  ctx.fillStyle = heart;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 章节主题场景:街道 / 公园 / 星空屋顶 轮换
// ---------------------------------------------------------------------------

export type SceneTheme = "street" | "park" | "rooftop";

export const SCENE_THEMES: readonly SceneTheme[] = ["street", "park", "rooftop"];

/** 章节 → 背景主题:按 chapterIndex 三主题轮换 */
export function sceneTheme(chapterIndex: number): SceneTheme {
  const i = ((chapterIndex % 3) + 3) % 3;
  return SCENE_THEMES[i];
}

// ---------------------------------------------------------------------------
// FX 粒子管理:冲刺残影 + 星星尾流 + 接触星花(destroy 一把归零)
// ---------------------------------------------------------------------------

export interface DashGhost {
  x: number;
  y: number;
  facing: 1 | -1;
  crouch: boolean;
  framesLeft: number;
}

export interface TrailStar {
  x: number;
  y: number;
  r: number;
  ageMs: number;
}

/** 星星尾流的渐隐透明度(300ms ease-out) */
export function trailAlpha(ageMs: number): number {
  return Math.max(0, 1 - easeOutQuad(ageMs / PH_ANIM.trailMs));
}

export class PhFx {
  readonly ghosts: DashGhost[] = [];
  readonly trail: TrailStar[] = [];
  readonly sparks = new SparklePool();

  /** 冲刺残影:两帧渐隐;reduced 不生成 */
  spawnGhost(x: number, y: number, facing: 1 | -1, crouch: boolean, reduced: boolean): void {
    if (reduced) return;
    this.ghosts.push({ x, y, facing, crouch, framesLeft: PH_ANIM.dashGhostFrames });
    while (this.ghosts.length > PH_ANIM.dashGhostFrames * 2 + 2) this.ghosts.shift();
  }

  /** 每渲染帧消耗一帧残影寿命(画完再调) */
  tickGhosts(): void {
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      if (--this.ghosts[i].framesLeft <= 0) this.ghosts.splice(i, 1);
    }
  }

  /** 星星尾流:每人同屏最多 3 颗;reduced 不生成 */
  spawnTrailStar(x: number, y: number, r: number, reduced: boolean): void {
    if (reduced) return;
    this.trail.push({ x, y, r, ageMs: 0 });
    while (this.trail.length > PH_ANIM.trailStars * 2) this.trail.shift();
  }

  updateTrail(dtMs: number): void {
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
      t.ageMs += dtMs;
      if (t.ageMs >= PH_ANIM.trailMs) this.trail.splice(i, 1);
    }
  }

  count(): number {
    return this.ghosts.length + this.trail.length + this.sparks.count();
  }

  clear(): void {
    this.ghosts.length = 0;
    this.trail.length = 0;
    this.sparks.clear();
  }
}
