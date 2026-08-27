/**
 * 飞机小队 1.3 · 纯视觉层(零 DOM、零玩法)。
 *
 * 这里只放三样东西:配色板与动效常量(全部魔法数的唯一出处)、
 * 主机 / 僚机共用的剪影路径 `planePath`、四种敌机的新剪影 `foeArt`。
 * 判定、弹幕、掉落一个数都不在这里 —— 那些在 bullets/logic,一行没动。
 */
import { SKY_H } from "./bullets";

// ---------------------------------------------------------------------------
// 四·补一 配色板(token 名与色值照抄规格表,测试逐项核对)
// ---------------------------------------------------------------------------

export const SKS_PALETTE = {
  /** 天空线性渐变顶 */
  sksSkyTop: "#BDE3FF",
  /** 天空线性渐变底 */
  sksSkyBottom: "#E8F6FF",
  /** 高空薄云 */
  sksCloudHi: "rgba(255,255,255,.28)",
  /** 中层棉花云主体 */
  sksCloudMid: "#FFFFFF",
  /** 朵朵机身主色 */
  sksPlanePink: "#F4859F",
  /** 星星机身主色 */
  sksPlaneBlue: "#7FB2F0",
  /** 尾焰内焰 */
  sksFlameIn: "#FFF4C2",
  /** 尾焰外焰 */
  sksFlameOut: "#FFB36B",
  /** 飞机投在云上的影子 */
  sksShadow: "rgba(70,90,120,.12)",
} as const;

/** 配色板之外的装饰色(全部集中在这,绘制层不许散落魔法色值) */
export const SKS_DECOR = {
  /** 低层大朵云云体(微带天色,受光边用纯白) */
  lowCloud: "#CFE6F8",
  /** 驾驶舱玻璃(上亮下深) */
  canopyTop: "#EAF8FF",
  canopyBottom: "#9CCBEE",
  /** 翼尖小灯:左红右绿 */
  wingLightL: "#FF8080",
  wingLightR: "#7FD8A4",
  /** 僚机牵引光索 */
  tether: "rgba(255,255,255,.38)",
  /** 装饰星屑 */
  sparkle: "#FFF6D8",
  /** BOSS 蓄力红晕 */
  bossGlow: "#FF9AA2",
  /** 敌弹主色(沿用 1.2:暖色大圆点,和冷色我方弹分开) */
  bulletFill: "#FFAF62",
} as const;

// ---------------------------------------------------------------------------
// 2.5D 云海:三档视差与图层序
// ---------------------------------------------------------------------------

/** 三层云的视差倍率:高空薄云 / 中层棉花云 / 低层大朵云 */
export const CLOUD_PARALLAX = { hi: 0.2, mid: 0.5, low: 0.9 } as const;

/** 云海基准滚速(世界 px/s,乘各层倍率;reduced 时基准直接给 0) */
export const CLOUD_BASE_SPEED = 60;

/** 云的回卷周期:飘出天空下沿这么多之后回到顶上 */
export const CLOUD_WRAP = SKY_H + 240;

/** 低层大朵云的透明度上限(360px 实测红线:不许盖住弹幕) */
export const LOW_CLOUD_ALPHA = 0.5;

/**
 * `draw` 每帧从底到顶的图层序(①–⑨)。
 * 判定核心画在 planes 层的最顶,永远不会被云或粒子盖住。
 */
export const LAYER_ORDER = [
  "sky", //      ① 天空渐变
  "cloudHi", //  ② 高空薄云(0.2×)
  "cloudMid", // ③ 中层棉花云(0.5×)+ 飞机投影
  "cloudLow", // ④ 低层大朵云(0.9×)
  "foes", //     ⑤ 敌机(含迫降滑行、Boss)与敌弹
  "shots", //    ⑥ 我方弹与拾取物
  "planes", //   ⑦ 主机 + 僚机(核心最顶)
  "puffs", //    ⑧ 粒子(烟圈 / 星屑 / 擦弹环)
  "hud", //      ⑨ 画布内 HUD(Boss 元气条 / 预告倒计时)
] as const;

export type LayerName = (typeof LAYER_ORDER)[number];

// ---------------------------------------------------------------------------
// 四·补三 动效时序(毫秒写死,测试引用)
// ---------------------------------------------------------------------------

/** 翼尖小灯交替闪的整周期(左亮半周、右亮半周);reduced 常亮 */
export const WING_LIGHT_PERIOD_MS = 800;

export function wingLights(ms: number, reduced: boolean): { left: boolean; right: boolean } {
  if (reduced) return { left: true, right: true };
  const half = WING_LIGHT_PERIOD_MS / 2;
  const phase = Math.floor(Math.max(0, ms) / half) % 2;
  return { left: phase === 0, right: phase === 1 };
}

/** 侧倾:120ms easeOut 跟随,压坡度时机身横向压到 0.82,内侧机翼抬 3px */
export const TILT = { followMs: 120, scaleXMin: 0.82, wingLiftPx: 3 } as const;

/** 侧倾量(-1..1)→ 机身横向缩放(1 → 0.82);只在绘制层用,world 坐标不动 */
export function tiltScaleX(tilt: number): number {
  const t = Math.min(1, Math.abs(tilt));
  return 1 - (1 - TILT.scaleXMin) * t;
}

/** 飞机投在中层云上的影子:透明度 0.12,随 y 越低越大(0.8–1.15) */
export const SHADOW = { alpha: 0.12, offsetY: 26, scaleMin: 0.8, scaleMax: 1.15 } as const;

export function shadowScaleAt(y: number): number {
  const t = Math.max(0, Math.min(1, y / SKY_H));
  return SHADOW.scaleMin + (SHADOW.scaleMax - SHADOW.scaleMin) * t;
}

/** 尾焰:内焰 = 外焰 0.6 倍同步缩放;抖动参数沿用 1.2(sin(clock×24)×4,基长 12) */
export const FLAME = { innerScale: 0.6, jitterHz: 24, jitterAmp: 4, baseLen: 12 } as const;

/** 敌弹拖尾:3 帧渐隐(reduced 保留 —— 拖尾是可读性,不是花活) */
export const TRAIL_FADE_FRAMES = 3;
/** 拖尾每帧回溯的时长(秒) */
export const TRAIL_STEP_S = 1 / 60;

/** 敌机被击打转烟圈:360ms easeOutQuad;reduced 用一帧白闪替代 */
export const SPIN_SMOKE_MS = 360;

export function easeOutQuad(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return 1 - (1 - k) * (1 - k);
}

/** 装饰星屑(翼尖拖出的小亮点):上限与寿命;reduced 一颗都不出 */
export const SPARKLE_MAX = 40;
export const SPARKLE_LIFE_S = 0.45;

/**
 * BOSS 蓄力红晕:cueLeft 递减 → 外圈红晕渐亮(功能提示,reduced 也保留)。
 * 预告刚开始就有淡淡一圈,快放大招时最亮。
 */
export function cueGlowAlpha(cueLeft: number, cueTotal: number): number {
  if (cueLeft <= 0 || cueTotal <= 0) return 0;
  const f = Math.max(0, Math.min(1, cueLeft / cueTotal));
  return 0.2 + 0.65 * (1 - f);
}

// ---------------------------------------------------------------------------
// 剪影路径:主机 / 僚机复用
// ---------------------------------------------------------------------------

/** 僚机 = 同一份主机路径按 0.55 缩放 */
export const WINGMAN_SCALE = 0.55;

export type ArtSeg =
  | { kind: "move"; x: number; y: number }
  | { kind: "line"; x: number; y: number }
  | { kind: "curve"; c1x: number; c1y: number; c2x: number; c2y: number; x: number; y: number }
  | { kind: "ellipse"; x: number; y: number; rx: number; ry: number }
  | { kind: "close" };

/** 把一串路径段放到画笔上(beginPath 自带;fill / stroke 谁调谁负责) */
export function tracePath(ctx: CanvasRenderingContext2D, segs: readonly ArtSeg[]): void {
  ctx.beginPath();
  for (const s of segs) {
    if (s.kind === "move") ctx.moveTo(s.x, s.y);
    else if (s.kind === "line") ctx.lineTo(s.x, s.y);
    else if (s.kind === "curve") ctx.bezierCurveTo(s.c1x, s.c1y, s.c2x, s.c2y, s.x, s.y);
    else if (s.kind === "ellipse") ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
    else ctx.closePath();
  }
}

export interface PlaneSilhouette {
  body: ArtSeg[];
  wingL: ArtSeg[];
  wingR: ArtSeg[];
  finL: ArtSeg[];
  finR: ArtSeg[];
}

interface PlaneShapeSpec {
  nose: number;
  bodyW: number;
  wing: { rootTop: number; c1: [number, number]; c2: [number, number]; tip: [number, number]; trail: [number, number]; back1: [number, number]; back2: [number, number]; rootBottom: number };
  fin: { root: [number, number]; c1: [number, number]; c2: [number, number]; tip: [number, number]; trail: [number, number]; b1: [number, number]; b2: [number, number]; rootBack: [number, number] };
}

/**
 * 两架主机的剪影参数:翼形 / 尾翼双通道区分,灰度截图也分得清。
 * 0 = 朵朵(圆润后掠翼 + 圆尾翼),1 = 星星(尖削后掠翼 + 双叉尾翼)。
 * 翼展保持 ±36 = 1.2 那两个机翼椭圆的外缘,PLANE_ART 的口径没变。
 */
const PLANE_SHAPES: readonly [PlaneShapeSpec, PlaneShapeSpec] = [
  {
    nose: -24,
    bodyW: 9,
    wing: { rootTop: -4, c1: [16, -3], c2: [28, 2], tip: [36, 9], trail: [33, 14], back1: [22, 15], back2: [12, 12], rootBottom: 10 },
    fin: { root: [3, 11], c1: [9, 12], c2: [13, 14], tip: [14, 19], trail: [11, 21], b1: [8, 19], b2: [5, 18], rootBack: [3, 17] },
  },
  {
    nose: -25,
    bodyW: 8,
    wing: { rootTop: -5, c1: [15, -5], c2: [27, 0], tip: [36, 6], trail: [34, 12], back1: [22, 13], back2: [12, 12], rootBottom: 10 },
    fin: { root: [3, 10], c1: [10, 11], c2: [15, 13], tip: [17, 17], trail: [13, 21], b1: [9, 19], b2: [6, 18], rootBack: [3, 17] },
  },
];

function mirrored(segs: readonly ArtSeg[]): ArtSeg[] {
  return segs.map((s) => {
    if (s.kind === "move" || s.kind === "line") return { ...s, x: -s.x };
    if (s.kind === "curve") return { ...s, c1x: -s.c1x, c2x: -s.c2x, x: -s.x };
    if (s.kind === "ellipse") return { ...s, x: -s.x };
    return s;
  });
}

function scaled(segs: readonly ArtSeg[], k: number): ArtSeg[] {
  return segs.map((s) => {
    if (s.kind === "move" || s.kind === "line") return { ...s, x: s.x * k, y: s.y * k };
    if (s.kind === "curve")
      return { ...s, c1x: s.c1x * k, c1y: s.c1y * k, c2x: s.c2x * k, c2y: s.c2y * k, x: s.x * k, y: s.y * k };
    if (s.kind === "ellipse") return { ...s, x: s.x * k, y: s.y * k, rx: s.rx * k, ry: s.ry * k };
    return s;
  });
}

/**
 * 主机剪影(机身 + 左右后掠机翼 + 左右尾翼),原点在判定核心。
 * 僚机传 `WINGMAN_SCALE` 复用同一份路径 —— 一眼看出是同队的缩小版。
 */
export function planePath(scale = 1, variant: 0 | 1 = 0): PlaneSilhouette {
  const sp = PLANE_SHAPES[variant] ?? PLANE_SHAPES[0];
  const w = sp.wing;
  const f = sp.fin;
  const wingR: ArtSeg[] = [
    { kind: "move", x: 5, y: w.rootTop },
    { kind: "curve", c1x: w.c1[0], c1y: w.c1[1], c2x: w.c2[0], c2y: w.c2[1], x: w.tip[0], y: w.tip[1] },
    { kind: "line", x: w.trail[0], y: w.trail[1] },
    { kind: "curve", c1x: w.back1[0], c1y: w.back1[1], c2x: w.back2[0], c2y: w.back2[1], x: 5, y: w.rootBottom },
    { kind: "close" },
  ];
  const finR: ArtSeg[] = [
    { kind: "move", x: f.root[0], y: f.root[1] },
    { kind: "curve", c1x: f.c1[0], c1y: f.c1[1], c2x: f.c2[0], c2y: f.c2[1], x: f.tip[0], y: f.tip[1] },
    { kind: "line", x: f.trail[0], y: f.trail[1] },
    { kind: "curve", c1x: f.b1[0], c1y: f.b1[1], c2x: f.b2[0], c2y: f.b2[1], x: f.rootBack[0], y: f.rootBack[1] },
    { kind: "close" },
  ];
  const bw = sp.bodyW;
  const body: ArtSeg[] = [
    { kind: "move", x: 0, y: sp.nose },
    { kind: "curve", c1x: bw * 0.66, c1y: sp.nose * 0.86, c2x: bw, c2y: -13, x: bw, y: -4 },
    { kind: "line", x: bw - 2, y: 14 },
    { kind: "curve", c1x: bw - 4, c1y: 19, c2x: 2, c2y: 20, x: 0, y: 20 },
    { kind: "curve", c1x: -2, c1y: 20, c2x: -(bw - 4), c2y: 19, x: -(bw - 2), y: 14 },
    { kind: "line", x: -bw, y: -4 },
    { kind: "curve", c1x: -bw, c1y: -13, c2x: -bw * 0.66, c2y: sp.nose * 0.86, x: 0, y: sp.nose },
    { kind: "close" },
  ];
  return {
    body: scaled(body, scale),
    wingL: scaled(mirrored(wingR), scale),
    wingR: scaled(wingR, scale),
    finL: scaled(mirrored(finR), scale),
    finR: scaled(finR, scale),
  };
}

// ---------------------------------------------------------------------------
// 四种敌机的新剪影(全部落在原 info.r 判定半径内,判定一个数没动)
// ---------------------------------------------------------------------------

export type FoePartRole = "base" | "light" | "dark" | "white";

export interface FoePart {
  role: FoePartRole;
  mode: "fill" | "stroke";
  segs: ArtSeg[];
}

/**
 * scout=纸飞机折痕剪影 / puff=气球飞艇(吊篮 + 系绳)/
 * kite=风筝(十字骨架 + 飘尾)/ tanker=胖运输艇(舷窗两枚 + 底部浮筒)。
 * 所有坐标都夹在 ±r 里,受光面在左上(全库光源 45°)。
 */
export function foeArt(kind: "scout" | "puff" | "kite" | "tanker", r: number): FoePart[] {
  switch (kind) {
    case "scout":
      // 纸飞机:机头朝下(朝玩家飞),中间一道折痕,右翼受光
      return [
        {
          role: "base",
          mode: "fill",
          segs: [
            { kind: "move", x: 0, y: r * 0.95 },
            { kind: "line", x: -r * 0.92, y: -r * 0.7 },
            { kind: "line", x: 0, y: -r * 0.35 },
            { kind: "close" },
          ],
        },
        {
          role: "light",
          mode: "fill",
          segs: [
            { kind: "move", x: 0, y: r * 0.95 },
            { kind: "line", x: r * 0.92, y: -r * 0.7 },
            { kind: "line", x: 0, y: -r * 0.35 },
            { kind: "close" },
          ],
        },
        {
          role: "dark",
          mode: "fill",
          segs: [
            { kind: "move", x: 0, y: r * 0.95 },
            { kind: "line", x: -r * 0.16, y: -r * 0.5 },
            { kind: "line", x: 0, y: -r * 0.72 },
            { kind: "line", x: r * 0.16, y: -r * 0.5 },
            { kind: "close" },
          ],
        },
      ];
    case "puff":
      // 气球飞艇:大气囊 + 左上高光 + 两根系绳吊着小吊篮
      return [
        { role: "base", mode: "fill", segs: [{ kind: "ellipse", x: 0, y: -r * 0.3, rx: r * 0.8, ry: r * 0.58 }] },
        { role: "light", mode: "fill", segs: [{ kind: "ellipse", x: -r * 0.28, y: -r * 0.5, rx: r * 0.32, ry: r * 0.2 }] },
        {
          role: "dark",
          mode: "stroke",
          segs: [
            { kind: "move", x: -r * 0.4, y: r * 0.15 },
            { kind: "line", x: -r * 0.22, y: r * 0.52 },
            { kind: "move", x: r * 0.4, y: r * 0.15 },
            { kind: "line", x: r * 0.22, y: r * 0.52 },
          ],
        },
        {
          role: "dark",
          mode: "fill",
          segs: [
            { kind: "move", x: -r * 0.3, y: r * 0.5 },
            { kind: "line", x: r * 0.3, y: r * 0.5 },
            { kind: "line", x: r * 0.22, y: r * 0.85 },
            { kind: "line", x: -r * 0.22, y: r * 0.85 },
            { kind: "close" },
          ],
        },
      ];
    case "kite":
      // 风筝:菱形面 + 十字骨架 + 两只蝴蝶结飘尾
      return [
        {
          role: "base",
          mode: "fill",
          segs: [
            { kind: "move", x: 0, y: -r * 0.95 },
            { kind: "line", x: r * 0.78, y: -r * 0.05 },
            { kind: "line", x: 0, y: r * 0.5 },
            { kind: "line", x: -r * 0.78, y: -r * 0.05 },
            { kind: "close" },
          ],
        },
        {
          role: "light",
          mode: "fill",
          segs: [
            { kind: "move", x: 0, y: -r * 0.95 },
            { kind: "line", x: -r * 0.78, y: -r * 0.05 },
            { kind: "line", x: 0, y: -r * 0.05 },
            { kind: "close" },
          ],
        },
        {
          role: "dark",
          mode: "stroke",
          segs: [
            { kind: "move", x: 0, y: -r * 0.95 },
            { kind: "line", x: 0, y: r * 0.5 },
            { kind: "move", x: -r * 0.78, y: -r * 0.05 },
            { kind: "line", x: r * 0.78, y: -r * 0.05 },
          ],
        },
        {
          role: "dark",
          mode: "stroke",
          segs: [
            { kind: "move", x: 0, y: r * 0.5 },
            { kind: "line", x: 0, y: r * 0.95 },
          ],
        },
        {
          role: "white",
          mode: "fill",
          segs: [
            { kind: "move", x: 0, y: r * 0.56 },
            { kind: "line", x: r * 0.14, y: r * 0.68 },
            { kind: "line", x: 0, y: r * 0.8 },
            { kind: "line", x: -r * 0.14, y: r * 0.68 },
            { kind: "close" },
          ],
        },
      ];
    case "tanker":
    default:
      // 胖运输艇:大肚艇身 + 顶鳍 + 左上受光 + 两枚舷窗 + 底部两只浮筒
      return [
        {
          role: "dark",
          mode: "fill",
          segs: [
            { kind: "move", x: -r * 0.08, y: -r * 0.78 },
            { kind: "line", x: r * 0.2, y: -r * 0.78 },
            { kind: "line", x: r * 0.08, y: -r * 0.45 },
            { kind: "line", x: -r * 0.08, y: -r * 0.45 },
            { kind: "close" },
          ],
        },
        { role: "base", mode: "fill", segs: [{ kind: "ellipse", x: 0, y: -r * 0.05, rx: r * 0.92, ry: r * 0.55 }] },
        { role: "light", mode: "fill", segs: [{ kind: "ellipse", x: -r * 0.3, y: -r * 0.28, rx: r * 0.38, ry: r * 0.16 }] },
        { role: "white", mode: "fill", segs: [{ kind: "ellipse", x: -r * 0.32, y: -r * 0.02, rx: r * 0.12, ry: r * 0.12 }] },
        { role: "white", mode: "fill", segs: [{ kind: "ellipse", x: r * 0.1, y: -r * 0.02, rx: r * 0.12, ry: r * 0.12 }] },
        { role: "dark", mode: "fill", segs: [{ kind: "ellipse", x: -r * 0.42, y: r * 0.62, rx: r * 0.26, ry: r * 0.14 }] },
        { role: "dark", mode: "fill", segs: [{ kind: "ellipse", x: r * 0.42, y: r * 0.62, rx: r * 0.26, ry: r * 0.14 }] },
      ];
  }
}

/** 一段路径里所有出现过的坐标(含贝塞尔控制点与椭圆外接盒),包围盒断言用 */
export function segExtent(segs: readonly ArtSeg[]): number {
  let m = 0;
  for (const s of segs) {
    if (s.kind === "move" || s.kind === "line") m = Math.max(m, Math.abs(s.x), Math.abs(s.y));
    else if (s.kind === "curve")
      m = Math.max(m, Math.abs(s.x), Math.abs(s.y), Math.abs(s.c1x), Math.abs(s.c1y), Math.abs(s.c2x), Math.abs(s.c2y));
    else if (s.kind === "ellipse") m = Math.max(m, Math.abs(s.x) + s.rx, Math.abs(s.y) + s.ry);
  }
  return m;
}
