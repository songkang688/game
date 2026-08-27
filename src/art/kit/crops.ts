/**
 * 共享美术套件 · 农场作物剪影（1.3 视觉升级 · 窗口8 B 档 math-farm 新增）。
 *
 * 约定：一个文件只归一个人，这一份归 math-farm（B 档）。
 * 全部是纯函数 + 常量：吃参数吐 SVG 字符串，不碰 DOM、不开计时器、无运行时依赖，
 * node 环境可直接断言。四种作物（萝卜 / 番茄 / 玉米 / 南瓜）× 三个成长阶段
 * （发芽 / 长叶 / 结果），外加「一筐 = 10」的竹篮图。
 *
 * 统一工序（4.2 规格）：
 *  - 2px 深色描边（主色向黑压 45% 推导）；
 *  - 左上 25% 处一块白色高光斑；
 *  - 果实底部一枚椭圆投影 rgba(0,0,0,.10)；
 *  - 「渐变」用双色分面模拟（亮面 + 暗面两层填充），刻意不用 <linearGradient>：
 *    同一页会同时铺几十个相同作物，重复的 defs id 是隐患，双色分面没有这个坑。
 */
import { shade } from "./palette";

/** 农场色板 token（4.1 规格原文照录，farmScene / illustrate 都从这里取色） */
export const FARM_PALETTE = {
  /** 菜畦深土 */
  soilDark: "#8a5a3b",
  /** 菜畦浅土垄面 */
  soilLight: "#b57e50",
  /** 萝卜主体 */
  carrotOrange: "#ff8c42",
  /** 番茄主体 */
  tomatoRed: "#ff6b6b",
  /** 玉米粒 */
  cornYellow: "#ffd93d",
  /** 南瓜 */
  pumpkinOrange: "#f4a83a",
  /** 叶片亮色 */
  leafGreen: "#7bc86c",
  /** 叶片暗色 */
  leafDark: "#569a48",
  /** 栅栏木 */
  fenceWood: "#d9a066",
  /** 选项木牌 */
  signWood: "#c98d54",
  /** 天空渐变顶 */
  skyTop: "#cfeaff",
  /** 天空渐变到地平线 */
  skyHorizon: "#fff8e1",
} as const;

export const CROP_KINDS = ["carrot", "tomato", "corn", "pumpkin"] as const;
export type CropKind = (typeof CROP_KINDS)[number];

export const CROP_STAGES = ["sprout", "leaf", "fruit"] as const;
export type CropStage = (typeof CROP_STAGES)[number];

/** 作物中文名（图例 / aria 文案用） */
export const CROP_NAMES: Record<CropKind, string> = {
  carrot: "萝卜",
  tomato: "番茄",
  corn: "玉米",
  pumpkin: "南瓜",
};

/** 统一描边宽度（px，viewBox 48 坐标系） */
export const CROP_OUTLINE_W = 2;

/** 果实底部投影的统一写法 */
export const CROP_SHADOW = "rgba(0,0,0,.10)";

/** 一筐装几个（「数量 > 10 换筐子」的那个 10） */
export const BASKET_UNIT = 10;

/** 题号 → 作物：萝卜 → 番茄 → 玉米 → 南瓜 轮着来，负数与小数也不炸 */
export function cropAt(index: number): CropKind {
  const n = Math.abs(Math.floor(Number.isFinite(index) ? index : 0));
  return CROP_KINDS[n % CROP_KINDS.length];
}

const P = FARM_PALETTE;

/** 每种作物的主色（描边色由它推导） */
export const CROP_MAIN: Record<CropKind, string> = {
  carrot: P.carrotOrange,
  tomato: P.tomatoRed,
  corn: P.cornYellow,
  pumpkin: P.pumpkinOrange,
};

function outlineOf(kind: CropKind): string {
  return shade(CROP_MAIN[kind], -45);
}

function svgOpen(kind: CropKind | "basket", stage: CropStage | "pack", size: number): string {
  const s = Math.max(8, Math.round(Number.isFinite(size) && size > 0 ? size : 32));
  return (
    `<svg viewBox="0 0 48 48" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg"` +
    ` aria-hidden="true" data-crop="${kind}" data-stage="${stage}">`
  );
}

/** 果实底部椭圆投影（统一规格） */
function groundShadow(cx = 24, cy = 42, rx = 13): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="3.4" fill="${CROP_SHADOW}"/>`;
}

/** 左上 25% 高光斑（统一规格） */
function highlight(cx: number, cy: number, rx = 3.4, ry = 2.2): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#ffffff" opacity=".4" transform="rotate(-24 ${cx} ${cy})"/>`;
}

/** 土面小土包（发芽 / 长叶阶段共用） */
function soilMound(ry = 4.4): string {
  return (
    `<ellipse cx="24" cy="41" rx="11" ry="${ry}" fill="${P.soilLight}"` +
    ` stroke="${P.soilDark}" stroke-width="${CROP_OUTLINE_W}"/>` +
    `<path d="M16 40.4 q4 -1.8 8 0 q4 1.8 8 0" fill="none" stroke="${P.soilDark}" stroke-width="1.2" opacity=".55"/>`
  );
}

/** 发芽阶段（四种共用骨架）：土包 + 两片子叶对生 */
function sproutBody(kind: CropKind): string {
  const o = outlineOf(kind);
  return (
    groundShadow(24, 43, 11) +
    soilMound() +
    `<path d="M24 38 L24 30" stroke="${P.leafDark}" stroke-width="${CROP_OUTLINE_W}" stroke-linecap="round"/>` +
    `<ellipse cx="18.5" cy="27.5" rx="6" ry="3.4" fill="${P.leafGreen}" stroke="${o}" stroke-width="${CROP_OUTLINE_W}" transform="rotate(-32 18.5 27.5)"/>` +
    `<ellipse cx="29.5" cy="27.5" rx="6" ry="3.4" fill="${P.leafGreen}" stroke="${o}" stroke-width="${CROP_OUTLINE_W}" transform="rotate(32 29.5 27.5)"/>` +
    highlight(17, 26, 2.2, 1.2)
  );
}

/** 长叶阶段（共用骨架）：茎秆 + 4 片真叶亮暗相间，叶脉一条中线 */
function leafBody(kind: CropKind): string {
  const o = outlineOf(kind);
  const leaf = (x: number, y: number, rot: number, fill: string): string =>
    `<g transform="rotate(${rot} ${x} ${y})">` +
    `<path d="M${x} ${y} q-7 -2.6 -9.5 3.2 q5.6 4 9.5 -1.4 Z" fill="${fill}" stroke="${o}" stroke-width="${CROP_OUTLINE_W}" stroke-linejoin="round"/>` +
    `<path d="M${x} ${y + 0.6} L${x - 7.4} ${y + 1.8}" stroke="${o}" stroke-width="1" opacity=".6"/>` +
    `</g>`;
  return (
    groundShadow(24, 43, 11) +
    soilMound(4) +
    `<path d="M24 40 L24 14" stroke="${P.leafDark}" stroke-width="${CROP_OUTLINE_W + 0.6}" stroke-linecap="round"/>` +
    leaf(23, 33, 8, P.leafGreen) +
    `<g transform="scale(-1,1) translate(-48,0)">${leaf(23, 27, 8, P.leafDark)}</g>` +
    leaf(23, 21, 4, P.leafGreen) +
    `<g transform="scale(-1,1) translate(-48,0)">${leaf(23, 15, 4, P.leafDark)}</g>` +
    highlight(20, 14, 2.4, 1.4)
  );
}

/** 结果阶段 · 萝卜：倒锥形橙身半埋土 + 顶叶三束 */
function carrotFruit(): string {
  const o = outlineOf("carrot");
  const tuft = (x: number, rot: number, fill: string): string =>
    `<ellipse cx="${x}" cy="16" rx="2.6" ry="6.4" fill="${fill}" stroke="${o}" stroke-width="1.6" transform="rotate(${rot} ${x} 16)"/>`;
  return (
    groundShadow(24, 43.5, 12) +
    tuft(18, -26, P.leafDark) +
    tuft(30, 26, P.leafDark) +
    tuft(24, 0, P.leafGreen) +
    // 倒锥形橙身：亮面整体 + 右侧暗面分面（模拟渐变）
    `<path d="M15.5 24 Q24 18.5 32.5 24 L26.2 40.8 Q24 43.6 21.8 40.8 Z" fill="${P.carrotOrange}" stroke="${o}" stroke-width="${CROP_OUTLINE_W}" stroke-linejoin="round"/>` +
    `<path d="M28.5 23.2 Q31 23.4 32.5 24 L26.2 40.8 Q25.4 41.8 24.6 42 Z" fill="${shade(P.carrotOrange, -14)}" opacity=".85"/>` +
    `<path d="M19.5 27.5 h6 M20.8 32 h4.6 M22 36.5 h2.8" stroke="${o}" stroke-width="1.2" opacity=".55" stroke-linecap="round"/>` +
    // 半埋土：土垄压住锥身下段
    `<ellipse cx="24" cy="41" rx="12" ry="3.6" fill="${P.soilLight}" stroke="${P.soilDark}" stroke-width="${CROP_OUTLINE_W}"/>` +
    highlight(19.5, 24.5)
  );
}

/** 结果阶段 · 番茄：圆果两颗 + 蒂星形 + 高光白点 */
function tomatoFruit(): string {
  const o = outlineOf("tomato");
  const calyx = (cx: number, cy: number): string =>
    `<path d="M${cx} ${cy} l2.6 -3.4 l0.6 3.2 l3 -1.4 l-1.6 3 l3.2 0.8 l-3.2 1 l1.4 2.8 l-3 -1.2 l-0.6 3 l-2.4 -3.2 Z"` +
    ` transform="translate(${-cx * 0.28} ${-cy * 0.28}) scale(1.28)" fill="${P.leafDark}" stroke="${outlineOf("tomato")}" stroke-width="1" stroke-linejoin="round"/>`;
  return (
    groundShadow(24, 42.5, 13) +
    `<path d="M17 20 q7 -6 14 0" fill="none" stroke="${P.leafDark}" stroke-width="${CROP_OUTLINE_W}"/>` +
    `<circle cx="17.5" cy="31" r="8.6" fill="${P.tomatoRed}" stroke="${o}" stroke-width="${CROP_OUTLINE_W}"/>` +
    `<path d="M17.5 39.6 a8.6 8.6 0 0 0 8.2 -11.2 a11 11 0 0 1 -8.2 11.2" fill="${shade(P.tomatoRed, -14)}" opacity=".8"/>` +
    `<circle cx="31" cy="33" r="7.4" fill="${P.tomatoRed}" stroke="${o}" stroke-width="${CROP_OUTLINE_W}"/>` +
    `<path d="M31 40.4 a7.4 7.4 0 0 0 7 -9.6 a9.6 9.6 0 0 1 -7 9.6" fill="${shade(P.tomatoRed, -14)}" opacity=".8"/>` +
    calyx(17.5, 23) +
    calyx(31, 26.4) +
    `<circle cx="14.5" cy="27.5" r="1.6" fill="#ffffff" opacity=".85"/>` +
    `<circle cx="28.4" cy="30.2" r="1.2" fill="#ffffff" opacity=".85"/>` +
    highlight(14, 27)
  );
}

/** 结果阶段 · 玉米：长棒 + 格纹粒 + 苞叶两片 */
function cornFruit(): string {
  const o = outlineOf("corn");
  return (
    groundShadow(24, 43, 11) +
    // 长棒（略斜），亮面 + 右缘暗面
    `<g transform="rotate(8 24 28)">` +
    `<rect x="18.5" y="12" width="11" height="26" rx="5.5" fill="${P.cornYellow}" stroke="${o}" stroke-width="${CROP_OUTLINE_W}"/>` +
    `<path d="M27.5 13 q2 5 2 13 t-2 11 q2.2 -1.6 2.2 -12.4 T27.5 13" fill="${shade(P.cornYellow, -16)}" opacity=".9"/>` +
    // 格纹粒：两纵三横
    `<path d="M22.2 13.5 V37 M25.8 13.5 V37" stroke="${o}" stroke-width="1.1" opacity=".6"/>` +
    `<path d="M19 19 h10 M19 25 h10 M19 31 h10" stroke="${o}" stroke-width="1.1" opacity=".6"/>` +
    `</g>` +
    // 苞叶两片（一亮一暗）
    `<path d="M17 38 q-4 -12 3.6 -22 q-0.4 12 1.6 21 q-2.6 2.6 -5.2 1 Z" fill="${P.leafGreen}" stroke="${outlineOf("corn")}" stroke-width="${CROP_OUTLINE_W}" stroke-linejoin="round"/>` +
    `<path d="M31.6 39 q5 -11 -0.6 -22.6 q1.8 12 -3 21.6 q1.4 2 3.6 1 Z" fill="${P.leafDark}" stroke="${outlineOf("corn")}" stroke-width="${CROP_OUTLINE_W}" stroke-linejoin="round"/>` +
    highlight(21, 15, 2.6, 1.6)
  );
}

/** 结果阶段 · 南瓜：扁圆 + 4 条棱线 + 卷须一根 */
function pumpkinFruit(): string {
  const o = outlineOf("pumpkin");
  return (
    groundShadow(24, 42.5, 14) +
    `<path d="M33 15 q4 -1 5 -5" fill="none" stroke="${P.leafDark}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M36.5 12.5 q3.4 0.4 3 3 q-0.4 2.4 -2.8 1.6 q-1.8 -0.6 -0.2 -2.2" fill="none" stroke="${P.leafDark}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<rect x="21.6" y="12" width="5" height="7" rx="2" fill="${P.leafDark}" stroke="${o}" stroke-width="1.6"/>` +
    `<ellipse cx="24" cy="30" rx="14.5" ry="11" fill="${P.pumpkinOrange}" stroke="${o}" stroke-width="${CROP_OUTLINE_W}"/>` +
    `<path d="M24 41 a14.5 11 0 0 0 13.4 -15.4 a17 13 0 0 1 -13.4 15.4" fill="${shade(P.pumpkinOrange, -13)}" opacity=".85"/>` +
    // 4 条棱线分瓣
    `<path d="M18 20.6 q-3.6 9.4 0 18.8 M24 19 v22 M30 20.6 q3.6 9.4 0 18.8 M13.2 24 q-2 6 0 12" fill="none" stroke="${o}" stroke-width="1.4" opacity=".65"/>` +
    highlight(17, 23.5, 3.8, 2.4)
  );
}

const FRUITS: Record<CropKind, () => string> = {
  carrot: carrotFruit,
  tomato: tomatoFruit,
  corn: cornFruit,
  pumpkin: pumpkinFruit,
};

/**
 * 作物贴纸：`crop(kind, stage, size)` → 完整 SVG 字符串。
 * 纯函数：同参数永远同输出；非法尺寸夹回 8px 起。
 */
export function crop(kind: CropKind, stage: CropStage, size = 32): string {
  const body = stage === "fruit" ? FRUITS[kind]() : stage === "leaf" ? leafBody(kind) : sproutBody(kind);
  return `${svgOpen(kind, stage, size)}${body}</svg>`;
}

/**
 * 竹篮（数量 > 10 的「一筐 = 10」约定图）：竹编剪影 + 「×10」角标。
 * `withBadge=false` 给收获仪式画空篮用。
 */
export function basket(size = 32, withBadge = true): string {
  const o = shade(P.fenceWood, -42);
  const badge = withBadge
    ? `<g data-badge="x10">` +
      `<rect x="26" y="4" width="19" height="12.5" rx="6.2" fill="#ffffff" stroke="${o}" stroke-width="1.6"/>` +
      `<text x="35.5" y="13.6" text-anchor="middle" font-size="9.5" font-weight="900" font-family="inherit" fill="${P.soilDark}">×10</text>` +
      `</g>`
    : "";
  return (
    svgOpen("basket", "pack", size) +
    groundShadow(24, 43, 14) +
    // 篮身梯形 + 竹编纹（斜格）+ 沿口
    `<path d="M10 20 L38 20 L34 40 Q24 43 14 40 Z" fill="${P.fenceWood}" stroke="${o}" stroke-width="${CROP_OUTLINE_W}" stroke-linejoin="round"/>` +
    `<path d="M13 24 l22 6 M13 30 l20 5.4 M14 36 l17 4 M35 24 l-22 6 M35 30 l-20 5.4 M34 36 l-17 4" stroke="${o}" stroke-width="1.1" opacity=".5"/>` +
    `<rect x="8.6" y="17.6" width="30.8" height="5" rx="2.5" fill="${P.signWood}" stroke="${o}" stroke-width="${CROP_OUTLINE_W}"/>` +
    `<path d="M15 18 q9 -9 18 0" fill="none" stroke="${o}" stroke-width="${CROP_OUTLINE_W + 0.4}" stroke-linecap="round"/>` +
    highlight(14, 22, 3, 1.8) +
    badge +
    `</svg>`
  );
}
