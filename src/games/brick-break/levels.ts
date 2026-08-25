/**
 * 碰碰砖块 · 99 关关卡表。
 * 六个主题章节、六种砖阵生成器（并非同一模板）：
 *  ①彩虹操场=整齐排砖  ②金字塔谷=金字塔阵  ③钻石湖=菱形棋盘阵
 *  ④钢铁堡垒=两下才碎的钢砖  ⑤流星雨=散落砖+球更快  ⑥银河大挑战=混合终极阵
 * 0=空 1=普通砖 2=钢砖（要打两下）
 */
import { mulberry32, type Chapter } from "../level99";

export const COLS = 8;

export interface BrickLevel {
  /** 砖阵（若干行 × 8 列） */
  layout: number[][];
  /** 球速（像素/秒） */
  ballSpeed: number;
  /** 球拍宽度 */
  paddleW: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "彩虹操场", emoji: "🌈", color: "#FFE3F1", desc: "把彩虹砖全部打碎！", size: 17 },
  { name: "金字塔谷", emoji: "🔺", color: "#FFF0C9", desc: "金字塔形的砖阵，从边上突破！", size: 17 },
  { name: "钻石湖", emoji: "💎", color: "#D6EBFF", desc: "菱形砖阵闪闪发光！", size: 17 },
  { name: "钢铁堡垒", emoji: "🏰", color: "#E8E6F0", desc: "灰色钢砖要打两下才碎！", size: 16 },
  { name: "流星雨", emoji: "☄️", color: "#FFE9D6", desc: "散落的砖块，球飞得更快！", size: 16 },
  { name: "银河大挑战", emoji: "🌌", color: "#E3DFF5", desc: "钢砖+快球+大阵，终极挑战！", size: 16 }
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
    default:
      return { layout: galaxy(5, rand), ballSpeed: 255 + t * 5, paddleW: 76 };
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
