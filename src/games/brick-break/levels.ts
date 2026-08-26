/**
 * 碰碰砖块 · 188 关关卡表。
 * 前 99 关是 1.0 的六大砖阵，生成参数与 seed 一个字都没动；
 * 1.1 在末尾追加四座新砖阵（第 100–188 关）：
 *  ⑦双子流星港=一次两颗球  ⑧滑动迷阵=砖阵左右滑动
 *  ⑨星门隧道=传送门砖  ⑩图案工坊=打掉发光图案砖就过关
 * 1.0 的六个主题章节、六种砖阵生成器（并非同一模板）：
 *  ①彩虹操场=整齐排砖  ②金字塔谷=金字塔阵  ③钻石湖=菱形棋盘阵
 *  ④钢铁堡垒=两下才碎的钢砖  ⑤流星雨=散落砖+球更快  ⑥银河大挑战=混合终极阵
 * 0=空 1=普通砖 2=钢砖（要打两下） 3=星门（打不碎，球会被传送） 4=图案砖（发光，图案关的目标）
 */
import { mulberry32, type Chapter } from "../level99";

export const COLS = 8;

/** 1.0 的六座砖阵：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新砖阵从这里开始往后排） */
export const LEGACY_LEVELS = 99;

export interface BrickLevel {
  /** 砖阵（若干行 × 8 列） */
  layout: number[][];
  /** 球速（像素/秒） */
  ballSpeed: number;
  /** 球拍宽度 */
  paddleW: number;
  /** 1.1 同时在场的球数，前 99 关不带（等于 1） */
  balls?: number;
  /** 1.1 砖阵左右滑动的峰值速度（像素/秒），前 99 关不带 */
  moveSpeed?: number;
  /** 1.1 砖阵滑动的最大幅度（像素），前 99 关不带 */
  moveRange?: number;
  /** 1.1 过关目标："pattern" = 打掉全部图案砖即可，前 99 关不带（清完全部砖） */
  goal?: "pattern";
}

export const CHAPTERS: Chapter[] = [
  { name: "彩虹操场", emoji: "🌈", color: "#FFE3F1", desc: "把彩虹砖全部打碎！", size: 17 },
  { name: "金字塔谷", emoji: "🔺", color: "#FFF0C9", desc: "金字塔形的砖阵，从边上突破！", size: 17 },
  { name: "钻石湖", emoji: "💎", color: "#D6EBFF", desc: "菱形砖阵闪闪发光！", size: 17 },
  { name: "钢铁堡垒", emoji: "🏰", color: "#E8E6F0", desc: "灰色钢砖要打两下才碎！", size: 16 },
  { name: "流星雨", emoji: "☄️", color: "#FFE9D6", desc: "散落的砖块，球飞得更快！", size: 16 },
  { name: "银河大挑战", emoji: "🌌", color: "#E3DFF5", desc: "钢砖+快球+大阵，终极挑战！", size: 16 },
  // ↓ 1.1 追加：四座新砖阵，合计 89 关
  { name: "双子流星港", emoji: "🪩", color: "#FFE9F0", desc: "一次两颗弹球，全掉光才算一次失误！", size: 23 },
  { name: "滑动迷阵", emoji: "🚟", color: "#E2F4E8", desc: "整片砖阵左右滑动，算好提前量再弹！", size: 22 },
  { name: "星门隧道", emoji: "🌀", color: "#E4E9FF", desc: "球一碰星门，就从另一扇门飞出来！", size: 22 },
  { name: "图案工坊", emoji: "🖼️", color: "#FFF2DC", desc: "打掉所有发光的图案砖就过关，其他砖随意！", size: 22 }
];

function rowsFull(n: number): number[][] {
  return Array.from({ length: n }, () => new Array(COLS).fill(1));
}

function pyramid(n: number): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row = new Array(COLS).fill(0);
    const span = Math.min(COLS, 2 + r * 2);
    const start = Math.floor((COLS - span) / 2);
    for (let c = start; c < start + span; c++) row[c] = 1;
    out.push(row);
  }
  return out;
}

function diamond(n: number): number[][] {
  const out: number[][] = [];
  const mid = (n - 1) / 2;
  for (let r = 0; r < n; r++) {
    const row = new Array(COLS).fill(0);
    const span = Math.max(2, COLS - Math.abs(r - mid) * 2);
    const start = Math.floor((COLS - span) / 2);
    for (let c = start; c < start + span; c++) row[c] = 1;
    out.push(row);
  }
  return out;
}

function fortress(n: number, steelRing: boolean): number[][] {
  const out = rowsFull(n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < COLS; c++) {
      const edge = r === 0 || c === 0 || c === COLS - 1;
      if (steelRing ? edge : r === 0) out[r][c] = 2;
    }
  }
  return out;
}

function scattered(n: number, density: number, rand: () => number): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row = new Array(COLS).fill(0);
    for (let c = 0; c < COLS; c++) if (rand() < density) row[c] = 1;
    out.push(row);
  }
  // 保底：至少 8 块砖
  let count = out.flat().filter((v) => v > 0).length;
  let guard = 0;
  while (count < 8 && guard++ < 100) {
    const r = Math.floor(rand() * n);
    const c = Math.floor(rand() * COLS);
    if (out[r][c] === 0) { out[r][c] = 1; count++; }
  }
  return out;
}

function galaxy(n: number, rand: () => number): number[][] {
  const base = rand() < 0.5 ? diamond(n) : pyramid(n);
  for (let r = 0; r < base.length; r++) {
    for (let c = 0; c < COLS; c++) {
      if (base[r][c] === 1 && rand() < 0.25) base[r][c] = 2;
    }
  }
  return base;
}

// ---------------------------------------------------------------------------
// 1.1 追加：四座新砖阵的生成器
// ---------------------------------------------------------------------------

/** 双子流星港：经典阵形轮着来，重点在两颗球的配合 */
function twinPort(n: number, t: number, rand: () => number): number[][] {
  const base = t % 3 === 0 ? rowsFull(n) : t % 3 === 1 ? pyramid(n + 1) : diamond(n + 1);
  if (t >= 12) {
    for (let r = 0; r < base.length; r++) {
      for (let c = 0; c < COLS; c++) {
        if (base[r][c] === 1 && rand() < 0.12) base[r][c] = 2;
      }
    }
  }
  return base;
}

/**
 * 滑动迷阵：两侧各留一列空位（砖阵滑起来不出画面），越到后面钢砖越多。
 */
function slidingMaze(n: number, t: number, rand: () => number): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row = new Array(COLS).fill(0);
    for (let c = 1; c < COLS - 1; c++) row[c] = 1;
    out.push(row);
  }
  if (t >= 8) {
    for (let r = 0; r < n; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (rand() < 0.12) out[r][c] = 2;
      }
    }
  }
  return out;
}

/** 星门隧道：经典阵形 + 一对传送星门（值 3，打不碎） */
function portalTunnel(n: number, rand: () => number): number[][] {
  const base = rand() < 0.5 ? diamond(n) : pyramid(n);
  const c1 = 1 + Math.floor(rand() * 2);
  const c2 = 5 + Math.floor(rand() * 2);
  base[0][c1] = 3;
  base[n - 1][c2] = 3;
  return base;
}

/**
 * 图案工坊的图案模板：'.'=空 'o'=普通砖 's'=钢砖 '#'=发光图案砖。
 * 打掉全部 '#' 就过关，'o' 和 's' 只是干扰。
 */
export const PATTERN_STENCILS: readonly (readonly string[])[] = [
  [ // 爱心
    "oosoosoo",
    "o##oo##o",
    "o######o",
    "oo####oo",
    "ooo##ooo",
  ],
  [ // 小星星
    "ooo##ooo",
    "s######s",
    "oo####oo",
    "o##oo##o",
    "oooooooo",
  ],
  [ // 小树
    "ooo##ooo",
    "oo####oo",
    "o######o",
    "soo##oos",
    "ooo##ooo",
  ],
  [ // 小房子
    "ooo##ooo",
    "oo####oo",
    "o######o",
    "o##oo##o",
    "s##oo##s",
  ],
];

const STENCIL_CHAR: Record<string, number> = { ".": 0, o: 1, s: 2, "#": 4 };

/** 图案工坊：模板轮着来，越到后面普通砖越多变成钢砖 */
function patternArt(t: number, rand: () => number): number[][] {
  const stencil = PATTERN_STENCILS[t % PATTERN_STENCILS.length];
  const steelChance = t >= 6 ? Math.min(0.3, 0.1 + t * 0.008) : 0;
  return stencil.map((line) =>
    line.split("").map((ch) => {
      const v = STENCIL_CHAR[ch] ?? 0;
      if (v === 1 && rand() < steelChance) return 2;
      return v;
    })
  );
}

function buildLevel(ci: number, t: number, rand: () => number): BrickLevel {
  switch (ci) {
    case 0:
      return { layout: rowsFull(2 + Math.floor(t / 5)), ballSpeed: 190 + t * 4, paddleW: 92 };
    case 1:
      return { layout: pyramid(3 + Math.floor(t / 6)), ballSpeed: 205 + t * 4, paddleW: 88 };
    case 2:
      return { layout: diamond(3 + 2 * Math.floor(t / 8)), ballSpeed: 215 + t * 4, paddleW: 86 };
    case 3:
      return { layout: fortress(3 + Math.floor(t / 6), t >= 8), ballSpeed: 220 + t * 4, paddleW: 84 };
    case 4:
      return { layout: scattered(4 + Math.floor(t / 8), 0.5 + t * 0.015, rand), ballSpeed: 245 + t * 5, paddleW: 80 };
    case 5:
      return { layout: galaxy(5, rand), ballSpeed: 255 + t * 5, paddleW: 76 };
    case 6:
      return { layout: twinPort(2 + Math.floor(t / 7), t, rand), ballSpeed: 225 + t * 3, paddleW: 88, balls: 2 };
    case 7:
      return {
        layout: slidingMaze(3 + Math.floor(t / 7), t, rand), ballSpeed: 230 + t * 3, paddleW: 84,
        moveSpeed: 26 + t, moveRange: 24 + Math.min(16, t)
      };
    case 8:
      return { layout: portalTunnel(4 + Math.floor(t / 8), rand), ballSpeed: 235 + t * 3, paddleW: 82 };
    default:
      return { layout: patternArt(t, rand), ballSpeed: 240 + t * 3, paddleW: 80, goal: "pattern" };
  }
}

export const LEVELS: BrickLevel[] = (() => {
  const out: BrickLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) {
      out.push(buildLevel(ci, t, mulberry32(ci * 512 + t * 13 + 3)));
    }
  });
  return out;
})();

/** 能被打碎的砖（普通/钢/图案），星门不算 */
export function isBreakable(v: number): boolean {
  return v === 1 || v === 2 || v === 4;
}

/** 数一数一片砖阵里能打碎的砖 */
export function breakableCount(layout: number[][]): number {
  return layout.flat().filter(isBreakable).length;
}

/** 找出砖阵里的全部星门格（应当恰好成对出现） */
export function portalCells(layout: number[][]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  layout.forEach((row, r) => row.forEach((v, c) => {
    if (v === 3) out.push([r, c]);
  }));
  return out;
}
