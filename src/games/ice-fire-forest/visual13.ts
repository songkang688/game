/**
 * 冰冰火火森林 · 1.3 视觉模块(只管画,不碰玩法)。
 *
 * 这里住着五样东西:
 *   1. 配色板(四·补一)与图层序、动效时序表(四·补三)—— 数值全部写死成常量,
 *      测试逐个对表,谁改了立刻红;
 *   2. `heroSilhouette`:双角色共用骨架、两套参数 —— 凛凛水滴形(上窄下宽两段贝塞尔)、
 *      焰焰火苗形(下圆上尖、尖端右偏),16px 灰度下靠剪影就能分出谁是谁;
 *   3. 纯函数相位:火苗跳动、围巾两帧摆、岩浆气泡与流动高光、宝石旋转闪点、
 *      旗帜飘动 —— 全由「毫秒 + reduced」算出来,不持有状态;
 *   4. `drawHeroFigure` / `drawCloudBuddy` / `drawControlRing`:角色绘制入口,
 *      返回「画了哪些件」的清单,可区分性用例逐件点名;
 *   5. `IffDustFx`:机关门开门尘土的小账本(280ms 两缕),destroy 一笔不剩。
 *
 * 分级红线:进池只有「借位小云朵」,没有任何坠落负面表达;与同类经典双人角色拉开差异 ——
 * 不用「头顶水滴 / 火焰」的经典头形,剪影差异做在**身形**上,配色回到本库粉彩。
 */

import { hexToRgb, shade, withAlpha } from "../../art/kit/palette";
import { strokeOutline } from "../../art/kit/outline";
import { easeOutQuad, easeOutSine } from "../../art/kit/sparkle";

// ---------------------------------------------------------------------------
// 四·补一 配色板(token 一个不许飘)
// ---------------------------------------------------------------------------

export const IFF_COLORS = {
  /** 凛凛主体渐变外缘(冰蓝 → 白芯的「冰蓝」端) */
  iffIceBody: "#9FD8F5",
  /** 凛凛主体渐变白芯 */
  iffIceCore: "#FFFFFF",
  /** 凛凛 1px 冷白边缘光 */
  iffIceRim: "#EFFBFF",
  /** 焰焰主体渐变外缘(橙红端) */
  iffFireBody: "#F5824E",
  /** 焰焰主体渐变明黄芯 */
  iffFireCore: "#FFE28A",
  /** 焰焰外缘暖光 */
  iffFireGlow: "rgba(255,178,102,.5)",
  /** 远层树冠剪影 */
  iffForestFar: "#C9E3D8",
  /** 中层树冠 / 树干基调 */
  iffForestMid: "#A8CBB8",
  /** 近层草叶与藤蔓(本款自加的第三层 token,饱和度同样压在主体 70% 以下) */
  iffForestNear: "#9DC2A6",
  /** 岩浆池主色(无写实火焰红) */
  iffLava: "#F0955A",
  /** 冰半场落影(冷蓝) */
  iffShadowCold: "rgba(110,150,200,.16)",
  /** 火半场落影(暖褐) */
  iffShadowWarm: "rgba(160,110,80,.16)",
} as const;

/** 冰火半场色温过渡:左冷右暖的低透明罩,中缝渐变(纯装饰) */
export const IFF_TINT_COLD = "rgba(159,216,245,.10)";
export const IFF_TINT_WARM = "rgba(245,130,78,.08)";

/**
 * 图层序(`render` 从底到顶),写全成常量只是把约定钉死:
 * ⑨ 的找伴箭头与虚线圈是功能件,永远压不住。
 */
export const IFF_LAYERS = [
  "sky",
  "forest-far",
  "forest-mid",
  "forest-near",
  "tiles",
  "pools-kit-gems",
  "heroes",
  "particles",
  "arrows-ring",
  "hud",
] as const;

// ---------------------------------------------------------------------------
// 四·补三 动效时序表(毫秒写死,测试引用)
// ---------------------------------------------------------------------------

/** 火苗发型跳动:600ms 循环(sin);reduced 静止火苗 */
export const FLAME_BOB_MS = 600;
/** 三簇火苗的相位差 0.3s */
export const FLAME_PHASE_MS = 300;
/** 围巾摆动:走路时 2 帧交替(step);reduced 静止 */
export const SCARF_FRAME_MS = 150;
export const SCARF_FRAMES = 2;
/** 岩浆气泡上浮:2000ms 循环(easeOutSine);reduced 不生成 */
export const LAVA_BUBBLE_MS = 2000;
/** 岩浆流动高光:3200ms 平移循环(linear);reduced 静止条 */
export const LAVA_SHEEN_MS = 3200;
/** 宝石旋转闪点:1800ms/圈(linear);reduced 静止高光 */
export const GEM_SPIN_MS = 1800;
/** 机关门开门尘土:280ms 两缕(easeOutQuad);reduced 不生成 */
export const GATE_DUST_MS = 280;
export const GATE_DUST_PUFFS = 2;
/** 集合点旗帜飘动:900ms 循环(sin);reduced 静止旗 */
export const FLAG_WAVE_MS = 900;

/** 跳跃时凛凛水滴尾端拉长 8%(只动绘制,判定格不动) */
export const ICE_JUMP_STRETCH = 0.08;
/** 跳跃时焰焰压扁再弹起的横 / 纵缩放(只包 save/restore) */
export const FIRE_JUMP_SQUASH: readonly [number, number] = [1.06, 0.92];
/** 焰焰外缘暖光的 shadowBlur(reduced 关) */
export const FIRE_GLOW_BLUR = 4;
/** 焰焰眉毛上挑 8°(性格差异) */
export const FIRE_BROW_RAD = (8 * Math.PI) / 180;
/** 落影:0.75 身宽、0.2 身高(相对身体半径) */
export const HERO_SHADOW = { w: 0.75, h: 0.2 } as const;
/** 当前控制角色虚线圈(功能件):半径倍率与虚线节奏和 1.2 一个数不差 */
export const CONTROL_RING = { radius: 1.42, dashOn: 0.1, dashOff: 0.09 } as const;

// ---------------------------------------------------------------------------
// 工具:HSL 饱和度(装饰层 ≤ 主体层 70% 的换算断言用)
// ---------------------------------------------------------------------------

export function saturationOf(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/** 稳定伪随机(0..1):装饰层摆件全靠它,同一格永远同一朵蘑菇 */
export function seed01(i: number, salt = 0): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ---------------------------------------------------------------------------
// 剪影:共用骨架函数、两套参数(四·补二 第 2 道工序)
// ---------------------------------------------------------------------------

export type HeroKind = "ice" | "fire";

interface SilhouetteSpec {
  /** 起笔点(尖端);单位空间:身体半径 = 1,原点在身体中心 */
  start: readonly [number, number];
  /** 依次的三次贝塞尔段 [c1x, c1y, c2x, c2y, x, y] */
  curves: ReadonlyArray<readonly [number, number, number, number, number, number]>;
}

/**
 * 剪影参数。凛凛:对称水滴,上窄下宽,最宽处压在中心以下;
 * 焰焰:下圆上尖,尖端右偏 0.10、右侧带一道内凹的火舌 —— 两条轮廓在
 * 16px 灰度下一个圆润一个带缺口,不用颜色也分得开。
 */
export function heroSilhouetteSegments(kind: HeroKind, stretch = 0): SilhouetteSpec {
  if (kind === "ice") {
    const apexY = -1.3 * (1 + Math.max(0, stretch));
    return {
      start: [0, apexY],
      curves: [
        [0.3, -0.9, 0.78, -0.35, 0.85, 0.25],
        [0.9, 0.7, 0.52, 0.95, 0, 0.95],
        [-0.52, 0.95, -0.9, 0.7, -0.85, 0.25],
        [-0.78, -0.35, -0.3, -0.9, 0, apexY],
      ],
    };
  }
  return {
    start: [0.1, -1.32],
    curves: [
      [0.34, -0.98, 0.3, -0.55, 0.55, -0.28],
      [0.82, -0.02, 0.95, 0.18, 0.88, 0.42],
      [0.8, 0.82, 0.45, 0.95, 0, 0.95],
      [-0.45, 0.95, -0.85, 0.72, -0.85, 0.3],
      [-0.8, -0.25, -0.25, -0.85, 0.1, -1.32],
    ],
  };
}

/** 剪影尖端(单位空间):凛凛正中、焰焰右偏 —— 可区分性用例点它 */
export function silhouetteApex(kind: HeroKind): { x: number; y: number } {
  const [x, y] = heroSilhouetteSegments(kind).start;
  return { x, y };
}

function cubicAt(
  p0x: number,
  p0y: number,
  c: readonly [number, number, number, number, number, number],
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  const x = u * u * u * p0x + 3 * u * u * t * c[0] + 3 * u * t * t * c[2] + t * t * t * c[4];
  const y = u * u * u * p0y + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5];
  return { x, y };
}

/** 沿剪影轮廓均匀取 n 个样点(单位空间)。两角色的点集不相等 = 剪影可区分 */
export function silhouettePoints(kind: HeroKind, n = 8): Array<{ x: number; y: number }> {
  const spec = heroSilhouetteSegments(kind);
  const pts: Array<{ x: number; y: number }> = [];
  const total = spec.curves.length;
  for (let i = 0; i < n; i++) {
    const u = (i / n) * total;
    const seg = Math.min(total - 1, Math.floor(u));
    const t = u - seg;
    const p0 = seg === 0 ? spec.start : ([spec.curves[seg - 1][4], spec.curves[seg - 1][5]] as const);
    pts.push(cubicAt(p0[0], p0[1], spec.curves[seg], t));
  }
  return pts;
}

/**
 * 把剪影路径落到画笔上(只建路径,fill / stroke 由调用方管)。
 * `stretch` 只对凛凛生效(跳跃尾端拉长 8%);判定格与半径都不在这里,动不了。
 */
export function heroSilhouette(
  ctx: CanvasRenderingContext2D,
  kind: HeroKind,
  cx = 0,
  cy = 0,
  r = 1,
  stretch = 0
): void {
  const spec = heroSilhouetteSegments(kind, stretch);
  ctx.beginPath();
  ctx.moveTo(cx + spec.start[0] * r, cy + spec.start[1] * r);
  for (const c of spec.curves) {
    ctx.bezierCurveTo(cx + c[0] * r, cy + c[1] * r, cx + c[2] * r, cy + c[3] * r, cx + c[4] * r, cy + c[5] * r);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// 纯函数相位:毫秒进、相位出
// ---------------------------------------------------------------------------

/** 第 i 簇火苗此刻的跳动量(-1..1,sin、相位差 0.3s);reduced 静止 */
export function flameBob(nowMs: number, i: number, reduced: boolean): number {
  if (reduced) return 0;
  return Math.sin(((nowMs - i * FLAME_PHASE_MS) / FLAME_BOB_MS) * Math.PI * 2);
}

/** 围巾这一帧摆到哪边:走路时 0/1 两帧交替(step);静止或 reduced 恒为 0 */
export function scarfFrame(nowMs: number, moving: boolean, reduced: boolean): number {
  if (!moving || reduced) return 0;
  return Math.floor(nowMs / SCARF_FRAME_MS) % SCARF_FRAMES;
}

export interface LavaBubble {
  /** 格内坐标(0..1) */
  u: number;
  v: number;
  r: number;
  alpha: number;
}

/** 岩浆气泡:2s 循环上浮(easeOutSine),每池两粒;reduced 一粒不生成 */
export function lavaBubbles(seed: number, nowMs: number, reduced: boolean): LavaBubble[] {
  if (reduced) return [];
  const out: LavaBubble[] = [];
  for (let k = 0; k < 2; k++) {
    const offset = seed01(seed, k) * LAVA_BUBBLE_MS;
    const t = ((nowMs + offset) % LAVA_BUBBLE_MS) / LAVA_BUBBLE_MS;
    const rise = easeOutSine(t);
    out.push({
      u: 0.3 + seed01(seed, k + 7) * 0.4,
      v: 0.78 - rise * 0.42,
      r: 0.045 + seed01(seed, k + 13) * 0.03,
      alpha: 1 - t,
    });
  }
  return out;
}

/** 岩浆流动高光条的平移相位(0..1,linear 循环);reduced 停在 0.35 的静止条 */
export function lavaSheenPhase(nowMs: number, reduced: boolean): number {
  if (reduced) return 0.35;
  return (nowMs % LAVA_SHEEN_MS) / LAVA_SHEEN_MS;
}

export interface GemSpark {
  /** 绕宝石中心的角度(弧度) */
  angle: number;
  /** 离中心的半径倍率 */
  dist: number;
}

/** 宝石旋转闪点:1800ms/圈;reduced 一粒不生成(静止高光另画) */
export function gemSparks(nowMs: number, seed: number, reduced: boolean): GemSpark[] {
  if (reduced) return [];
  const angle = ((nowMs % GEM_SPIN_MS) / GEM_SPIN_MS) * Math.PI * 2 + seed01(seed) * Math.PI * 2;
  return [{ angle, dist: 0.92 }];
}

/** 旗帜此刻的飘动量(-1..1,sin);reduced 静止旗 */
export function flagWave(nowMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return Math.sin((nowMs / FLAG_WAVE_MS) * Math.PI * 2);
}

// ---------------------------------------------------------------------------
// 双角色工序单(四·补二):落影 → 剪影 → 三停渐变 → 材质 → 头饰 → 附件 → 表情 → 动态
// ---------------------------------------------------------------------------

export interface HeroFigureOpts {
  kind: HeroKind;
  cx: number;
  cy: number;
  /** 身体半径(= 1.2 里那颗圆的 cell*0.33,判定观感不变) */
  r: number;
  nowMs: number;
  reduced: boolean;
  /** 在走格子吗(围巾摆动 / 火苗后倒) */
  moving: boolean;
  /** 被顶举飞在空中吗(形变) */
  jumping: boolean;
  /** 面朝的横向(-1 左 / 0 竖直 / 1 右):火苗后倒用 */
  leanX: number;
  /** 击掌白闪(功能反馈,沿用 1.2) */
  flash: boolean;
  /** 要不要画落影(小云朵态不画) */
  shadow: boolean;
}

/**
 * 画一位主角,返回「画了哪些件」的清单(测试逐件点名)。
 * 所有形变都包在 save/restore 里;这里拿到的只是画笔与几何,碰不到任何判定。
 */
export function drawHeroFigure(ctx: CanvasRenderingContext2D, o: HeroFigureOpts): readonly string[] {
  const parts: string[] = [];
  const { kind, cx, cy, r, nowMs, reduced } = o;
  const body = kind === "ice" ? IFF_COLORS.iffIceBody : IFF_COLORS.iffFireBody;
  const core = kind === "ice" ? IFF_COLORS.iffIceCore : IFF_COLORS.iffFireCore;

  // 1. 落影:凛凛冷蓝 / 焰焰暖褐(0.75 身宽、0.2 身高)
  if (o.shadow) {
    ctx.save();
    ctx.fillStyle = kind === "ice" ? IFF_COLORS.iffShadowCold : IFF_COLORS.iffShadowWarm;
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 1.05, r * HERO_SHADOW.w, r * HERO_SHADOW.h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    parts.push("shadow");
  }

  // 焰焰脚下暖色光斑(静态渐变,reduced 保留)
  if (kind === "fire") {
    ctx.save();
    const pool = ctx.createRadialGradient(cx, cy + r * 0.9, r * 0.1, cx, cy + r * 0.9, r * 0.85);
    pool.addColorStop(0, IFF_COLORS.iffFireGlow);
    pool.addColorStop(1, withAlpha(IFF_COLORS.iffFireBody, 0));
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.95, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    parts.push("foot-glow");
  }

  // 8. 动态形变:只包 save/restore,判定格不动
  ctx.save();
  const stretch = kind === "ice" && o.jumping ? ICE_JUMP_STRETCH : 0;
  if (kind === "fire" && o.jumping) {
    ctx.translate(cx, cy + r * 0.95);
    ctx.scale(FIRE_JUMP_SQUASH[0], FIRE_JUMP_SQUASH[1]);
    ctx.translate(-cx, -(cy + r * 0.95));
    parts.push("squash");
  }
  if (stretch > 0) parts.push("stretch");

  // 2+3. 剪影 + 三停渐变(高光偏左上 0.35,光源统一左上 45°)
  heroSilhouette(ctx, kind, cx, cy, r, stretch);
  if (o.flash) {
    ctx.fillStyle = "#FFFFFF";
  } else {
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r * 1.15);
    g.addColorStop(0, core);
    g.addColorStop(0.55, shade(body, kind === "ice" ? 30 : 20));
    g.addColorStop(1, body);
    ctx.fillStyle = g;
  }

  // 4a. 焰焰外缘暖光 glow(shadowBlur 4,reduced 关)
  if (kind === "fire" && !reduced) {
    ctx.save();
    ctx.shadowColor = IFF_COLORS.iffFireGlow;
    ctx.shadowBlur = FIRE_GLOW_BLUR;
    ctx.fill();
    ctx.restore();
    parts.push("glow");
  } else {
    ctx.fill();
  }
  strokeOutline(ctx, body, Math.max(1.5, r * 0.16));
  parts.push("silhouette", "gradient");

  // 4b. 凛凛材质:内部两道 45° 冰棱反光斜线 + 1px 冷白 rim light
  if (kind === "ice") {
    ctx.save();
    heroSilhouette(ctx, kind, cx, cy, r, stretch);
    ctx.clip();
    ctx.strokeStyle = withAlpha("#FFFFFF", 0.4);
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.lineCap = "round";
    for (const k of [0, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx - r * (0.55 - k * 0.35), cy + r * (0.5 - k * 0.15));
      ctx.lineTo(cx - r * (0.05 - k * 0.35), cy + r * (0 - k * 0.15));
      ctx.stroke();
    }
    ctx.restore();
    parts.push("ice-shards");

    heroSilhouette(ctx, kind, cx, cy, r, stretch);
    ctx.strokeStyle = IFF_COLORS.iffIceRim;
    ctx.lineWidth = 1;
    ctx.stroke();
    parts.push("rim");
  }

  // 5. 头饰:凛凛六角雪花簇三枝 / 焰焰跳动火苗三簇(相位差 0.3s)
  if (kind === "ice") {
    const apexY = cy - r * 1.3 * (1 + stretch);
    const sprigs: Array<[number, number, number]> = [
      [cx, apexY - r * 0.16, 0.2],
      [cx - r * 0.34, apexY + r * 0.18, 0.14],
      [cx + r * 0.34, apexY + r * 0.18, 0.14],
    ];
    ctx.save();
    ctx.strokeStyle = IFF_COLORS.iffIceRim;
    ctx.lineCap = "round";
    for (const [sx, sy, sr] of sprigs) {
      ctx.lineWidth = Math.max(1, r * 0.09);
      for (let a = 0; a < 3; a++) {
        const ang = (Math.PI / 3) * a;
        ctx.beginPath();
        ctx.moveTo(sx - Math.cos(ang) * r * sr, sy - Math.sin(ang) * r * sr);
        ctx.lineTo(sx + Math.cos(ang) * r * sr, sy + Math.sin(ang) * r * sr);
        ctx.stroke();
      }
    }
    ctx.restore();
    parts.push("snow-sprig");
  } else {
    const lean = o.moving && !reduced ? -o.leanX * r * 0.18 : 0;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const bob = flameBob(nowMs, i, reduced) * r * 0.07;
      const bx = cx + (i - 1) * r * 0.3 + lean;
      const baseY = cy - r * (i === 1 ? 1.28 : 1.05);
      const tipY = baseY - r * (i === 1 ? 0.42 : 0.3) + bob;
      ctx.fillStyle = i === 1 ? IFF_COLORS.iffFireCore : shade(IFF_COLORS.iffFireBody, 18);
      ctx.beginPath();
      ctx.moveTo(bx, tipY);
      ctx.quadraticCurveTo(bx + r * 0.16, baseY - r * 0.08, bx, baseY + r * 0.1);
      ctx.quadraticCurveTo(bx - r * 0.16, baseY - r * 0.08, bx, tipY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    parts.push("flame-tuft");
  }

  // 6. 附件:凛凛围巾(走路两帧摆)/ 焰焰腰带(静态)
  if (kind === "ice") {
    const frame = scarfFrame(nowMs, o.moving, reduced);
    const ny = cy - r * 0.52;
    ctx.save();
    ctx.fillStyle = shade(IFF_COLORS.iffIceBody, -12);
    ctx.beginPath();
    ctx.ellipse(cx, ny, r * 0.62, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    const tx = cx + r * (0.34 + frame * 0.14);
    const ty = ny + r * (0.28 + frame * 0.1);
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.3, ny);
    ctx.quadraticCurveTo(tx + r * 0.2, ny + r * 0.2, tx, ty + r * 0.34);
    ctx.quadraticCurveTo(tx - r * 0.24, ty + r * 0.12, cx + r * 0.12, ny + r * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    parts.push("scarf");
  } else {
    ctx.save();
    ctx.fillStyle = shade(IFF_COLORS.iffFireCore, -18);
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.42, r * 0.78, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = IFF_COLORS.iffFireCore;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.42, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    parts.push("belt");
  }

  // 7. 表情:共用眼弧参数,焰焰眉毛上挑 8°
  ctx.fillStyle = "#3B3358";
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + k * r * 0.34, cy - r * 0.1, Math.max(1.2, r * 0.13), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#3B3358";
  ctx.lineWidth = Math.max(1, r * 0.13);
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.18, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  parts.push("face");
  if (kind === "fire") {
    ctx.save();
    ctx.lineCap = "round";
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + k * r * 0.44, cy - r * 0.34);
      ctx.lineTo(
        cx + k * r * 0.2,
        cy - r * 0.34 - Math.tan(FIRE_BROW_RAD) * r * 0.24 - r * 0.06
      );
      ctx.stroke();
    }
    ctx.restore();
    parts.push("brow");
  }

  ctx.restore();
  return parts;
}

/**
 * 借位小云朵(进池 = 变小云朵换个地方接着玩,没有任何负面表达)。
 * 比 1.2 软:四团圆 + 眯眯眼 + 腮红;判定与时序仍由调用方的 cloudPath 说了算。
 */
export function drawCloudBuddy(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  tone: string
): readonly string[] {
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = shade(tone, 25);
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.beginPath();
  ctx.arc(cx - r * 0.52, cy + r * 0.06, r * 0.48, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.48, cy + r * 0.08, r * 0.42, 0, Math.PI * 2);
  ctx.arc(cx - r * 0.05, cy - r * 0.32, r * 0.55, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.1, cy + r * 0.28, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 眯眯眼(两道下弯小弧):飘回去的路上也是放松的
  ctx.strokeStyle = tone;
  ctx.lineWidth = Math.max(1.2, r * 0.11);
  ctx.lineCap = "round";
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + k * r * 0.24, cy - r * 0.14, r * 0.13, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  ctx.fillStyle = withAlpha(tone, 0.35);
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + k * r * 0.45, cy + r * 0.02, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return ["puffs", "sleepy-eyes", "blush"];
}

/** 当前控制角色的虚线圈(功能件,最顶层):数值与 1.2 一个不差 */
export function drawControlRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  tone: string,
  cell: number
): void {
  ctx.strokeStyle = tone;
  ctx.lineWidth = Math.max(2, cell * 0.07);
  ctx.setLineDash([cell * CONTROL_RING.dashOn, cell * CONTROL_RING.dashOff]);
  ctx.beginPath();
  ctx.arc(cx, cy, r * CONTROL_RING.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** HUD 双人头像(小卡片里的迷你脸):画一次就够,不进帧循环 */
export function drawMiniHero(ctx: CanvasRenderingContext2D, kind: HeroKind, size: number): void {
  const cx = size / 2;
  const cy = size * 0.58;
  const r = size * 0.34;
  drawHeroFigure(ctx, {
    kind,
    cx,
    cy,
    r,
    nowMs: 0,
    reduced: true,
    moving: false,
    jumping: false,
    leanX: 0,
    flash: false,
    shadow: false,
  });
}

// ---------------------------------------------------------------------------
// 森林三层视差(视差比例 0.18/0.34/0.55 由调用方原样传入)
// ---------------------------------------------------------------------------

/** 三层视差比例:1.2 的原值,只读断言盯着它 */
export const IFF_PARALLAX_DEPTHS: readonly [number, number, number] = [0.18, 0.34, 0.55];
/** 三层的基线高度(视口比例),沿用 1.2 的排布 */
export const IFF_PARALLAX_TOPS: readonly [number, number, number] = [0.52, 0.68, 0.84];

/** 远层:雾色树冠剪影带(连绵的冠形,替换白圆) */
export function drawForestFar(
  ctx: CanvasRenderingContext2D,
  shift: number,
  viewW: number,
  viewH: number,
  baseY: number,
  span: number
): void {
  ctx.save();
  ctx.fillStyle = IFF_COLORS.iffForestFar;
  ctx.beginPath();
  ctx.moveTo(0, viewH);
  const first = Math.floor(-shift / span) - 1;
  const last = first + Math.ceil(viewW / span) + 2;
  for (let i = first; i <= last; i++) {
    const x = shift + i * span;
    const h = span * (0.42 + seed01(i, 1) * 0.3);
    ctx.lineTo(x, baseY);
    ctx.quadraticCurveTo(x + span * 0.22, baseY - h, x + span * 0.5, baseY - h * 0.72);
    ctx.quadraticCurveTo(x + span * 0.78, baseY - h * 0.94, x + span, baseY);
  }
  ctx.lineTo(viewW, viewH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 中层:冷暖两色树干 + 树冠 + 蘑菇点缀 */
export function drawForestMid(
  ctx: CanvasRenderingContext2D,
  shift: number,
  viewW: number,
  viewH: number,
  baseY: number,
  span: number
): void {
  ctx.save();
  const first = Math.floor(-shift / span) - 1;
  const last = first + Math.ceil(viewW / span) + 2;
  // 底带
  ctx.fillStyle = withAlpha(IFF_COLORS.iffForestMid, 0.5);
  ctx.fillRect(0, baseY, viewW, viewH - baseY);
  for (let i = first; i <= last; i++) {
    const x = shift + i * span + seed01(i, 2) * span * 0.3;
    const trunkH = span * (0.5 + seed01(i, 3) * 0.24);
    const warm = i % 2 === 0;
    // 树干:冷暖两色交替(冰火半场的语言渗进背景)
    ctx.fillStyle = warm ? shade(IFF_COLORS.iffLava, 26) : shade(IFF_COLORS.iffForestMid, -14);
    const tw = Math.max(2, span * 0.07);
    ctx.fillRect(x - tw / 2, baseY - trunkH, tw, trunkH);
    // 树冠
    ctx.fillStyle = IFF_COLORS.iffForestMid;
    ctx.beginPath();
    ctx.arc(x, baseY - trunkH, span * (0.2 + seed01(i, 4) * 0.1), 0, Math.PI * 2);
    ctx.arc(x - span * 0.13, baseY - trunkH + span * 0.08, span * 0.14, 0, Math.PI * 2);
    ctx.arc(x + span * 0.13, baseY - trunkH + span * 0.08, span * 0.14, 0, Math.PI * 2);
    ctx.fill();
    // 蘑菇点缀(每隔几棵一朵)
    if (seed01(i, 5) > 0.55) {
      const mx = x + span * 0.28;
      const mr = span * 0.06;
      ctx.fillStyle = withAlpha("#E8A5A0", 0.9);
      ctx.beginPath();
      ctx.arc(mx, baseY - mr * 0.8, mr, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#F6EEE6";
      ctx.fillRect(mx - mr * 0.24, baseY - mr * 0.8, mr * 0.48, mr * 0.8);
    }
  }
  ctx.restore();
}

/** 近层:草叶与藤蔓 */
export function drawForestNear(
  ctx: CanvasRenderingContext2D,
  shift: number,
  viewW: number,
  viewH: number,
  baseY: number,
  span: number
): void {
  ctx.save();
  ctx.globalAlpha = 0.55;
  const first = Math.floor(-shift / span) - 1;
  const last = first + Math.ceil(viewW / span) + 2;
  ctx.fillStyle = IFF_COLORS.iffForestNear;
  ctx.fillRect(0, baseY + span * 0.16, viewW, viewH - baseY);
  ctx.strokeStyle = shade(IFF_COLORS.iffForestNear, -10);
  ctx.lineCap = "round";
  for (let i = first; i <= last; i++) {
    const x = shift + i * span;
    // 三根草叶
    ctx.lineWidth = Math.max(1.2, span * 0.035);
    for (let b = 0; b < 3; b++) {
      const gx = x + span * (0.16 + b * 0.3 + seed01(i, b + 6) * 0.1);
      const gh = span * (0.2 + seed01(i, b + 9) * 0.16);
      const sway = (seed01(i, b + 12) - 0.5) * span * 0.16;
      ctx.beginPath();
      ctx.moveTo(gx, baseY + span * 0.18);
      ctx.quadraticCurveTo(gx + sway, baseY + span * 0.02, gx + sway * 1.6, baseY + span * 0.18 - gh);
      ctx.stroke();
    }
    // 一段藤蔓 + 叶点
    if (seed01(i, 15) > 0.5) {
      ctx.lineWidth = Math.max(1, span * 0.028);
      ctx.beginPath();
      ctx.moveTo(x, baseY + span * 0.1);
      ctx.quadraticCurveTo(x + span * 0.3, baseY - span * 0.06, x + span * 0.6, baseY + span * 0.08);
      ctx.stroke();
      ctx.fillStyle = shade(IFF_COLORS.iffForestNear, -6);
      ctx.beginPath();
      ctx.ellipse(x + span * 0.32, baseY - span * 0.02, span * 0.05, span * 0.03, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// IffDustFx:机关门开门尘土账本(280ms 两缕;reduced 不生成)
// ---------------------------------------------------------------------------

interface DustPuff {
  /** 格坐标(画的时候再乘 cell) */
  x: number;
  y: number;
  /** 往左还是往右飘 */
  dx: number;
  at: number;
}

export class IffDustFx {
  private puffs: DustPuff[] = [];
  private lastOpen = new Map<number, boolean>();

  /** 每帧对每扇看得见的门报一次开合;false→true 的那一下撒两缕(reduced 不撒) */
  noteGate(pos: number, open: boolean, gx: number, gy: number, now: number, reduced: boolean): void {
    const prev = this.lastOpen.get(pos);
    this.lastOpen.set(pos, open);
    if (prev === undefined || prev || !open || reduced) return;
    for (const dx of [-1, 1]) {
      this.puffs.push({ x: gx + 0.5 + dx * 0.22, y: gy + 0.82, dx, at: now });
    }
  }

  /** 过期的账目划掉 */
  step(now: number): void {
    this.puffs = this.puffs.filter((p) => now <= p.at + GATE_DUST_MS);
  }

  /** 画在粒子层(图层序 ⑧) */
  draw(ctx: CanvasRenderingContext2D, cell: number, now: number): void {
    for (const p of this.puffs) {
      const t = Math.max(0, Math.min(1, (now - p.at) / GATE_DUST_MS));
      const k = easeOutQuad(t);
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.fillStyle = "#D9CFC2";
      for (const [ox, oy, orr] of [
        [p.dx * k * 0.3, -k * 0.12, 0.08],
        [p.dx * (0.1 + k * 0.42), -k * 0.2, 0.055],
      ]) {
        ctx.beginPath();
        ctx.arc((p.x + ox) * cell, (p.y + oy) * cell, cell * (orr + k * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** 账上还挂着几缕(测试与 destroy 复查用) */
  get pending(): number {
    return this.puffs.length;
  }

  /** destroy:一笔不剩 */
  reset(): void {
    this.puffs.length = 0;
    this.lastOpen.clear();
  }
}

// ---------------------------------------------------------------------------
// 修复员 G2:三组功能 icon 矢量化(门锁挂锁 / 元素门徽记 / 顶举双弧)
// 全是静态小件,reduced 无关;底座(门板 / 虚线圈)由调用方照旧画。
// ---------------------------------------------------------------------------

/**
 * 挂锁(替换锁 emoji 字形):圆环锁弓 + 圆角方体 2 停 + 锁孔。
 * open 时锁弓向右上抬起(开口朝下),一眼分「开 / 锁」;s 是锁体半高。
 */
export function drawPadlock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  open: boolean,
  color: string
): void {
  const bw = s * 1.3;
  const bh = s * 1.05;
  const bodyTop = cy - s * 0.1;
  // 锁弓:锁上是完整倒 U;开锁时右脚抬起、整体右移上提
  ctx.strokeStyle = shade(color, -14);
  ctx.lineWidth = Math.max(1.5, s * 0.24);
  ctx.lineCap = "round";
  ctx.beginPath();
  if (open) {
    ctx.arc(cx + s * 0.42, bodyTop - s * 0.5, s * 0.52, Math.PI, Math.PI * 1.9);
  } else {
    ctx.arc(cx, bodyTop - s * 0.28, s * 0.5, Math.PI, Math.PI * 2);
  }
  ctx.stroke();
  ctx.lineCap = "butt";
  // 锁体:圆角方体 2 停(顶亮 +14)
  const grad = ctx.createLinearGradient(0, bodyTop, 0, bodyTop + bh);
  grad.addColorStop(0, shade(color, 14));
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 + s * 0.2, bodyTop);
  ctx.lineTo(cx + bw / 2 - s * 0.2, bodyTop);
  ctx.quadraticCurveTo(cx + bw / 2, bodyTop, cx + bw / 2, bodyTop + s * 0.2);
  ctx.lineTo(cx + bw / 2, bodyTop + bh - s * 0.2);
  ctx.quadraticCurveTo(cx + bw / 2, bodyTop + bh, cx + bw / 2 - s * 0.2, bodyTop + bh);
  ctx.lineTo(cx - bw / 2 + s * 0.2, bodyTop + bh);
  ctx.quadraticCurveTo(cx - bw / 2, bodyTop + bh, cx - bw / 2, bodyTop + bh - s * 0.2);
  ctx.lineTo(cx - bw / 2, bodyTop + s * 0.2);
  ctx.quadraticCurveTo(cx - bw / 2, bodyTop, cx - bw / 2 + s * 0.2, bodyTop);
  ctx.closePath();
  ctx.fill();
  strokeOutline(ctx, color, 1.5);
  // 锁孔:小圆 + 短槽(白,醒目)
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.beginPath();
  ctx.arc(cx, bodyTop + bh * 0.42, Math.max(1, s * 0.18), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - Math.max(0.75, s * 0.08), bodyTop + bh * 0.46, Math.max(1.5, s * 0.16), bh * 0.3);
}

/**
 * 元素门徽记(替换雪花 / 火焰字形):直接把两位主角的水滴 / 火苗剪影
 * 缩成小徽记复用几何 —— 门面与「谁能进」用同一套形状语言。
 */
export function drawDoorBadge(
  ctx: CanvasRenderingContext2D,
  kind: HeroKind,
  cx: number,
  cy: number,
  r: number,
  color: string
): void {
  heroSilhouette(ctx, kind, cx, cy, r);
  ctx.fillStyle = color;
  ctx.fill();
  strokeOutline(ctx, color, 1.5);
  // 左上小高光点(与主角同源的光语言)
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.3, Math.max(0.8, r * 0.16), 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 顶举符号(替换双手 emoji 字形):两条圆头「托举弧」+ 弧上小圆
 * (被托起的那颗),s 是符号半宽。
 */
export function drawLiftIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.22);
  ctx.lineCap = "round";
  for (const [oy, rr] of [
    [s * 0.5, s * 0.95],
    [s * 0.78, s * 0.6],
  ] as Array<[number, number]>) {
    ctx.beginPath();
    ctx.arc(cx, cy + oy - rr, rr, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.45, Math.max(1.5, s * 0.28), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath();
  ctx.arc(cx - s * 0.09, cy - s * 0.54, Math.max(0.6, s * 0.09), 0, Math.PI * 2);
  ctx.fill();
}
