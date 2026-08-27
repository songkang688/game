/**
 * 扫雷花园 · 188 关。
 *
 * 8 章，章节大小之和恒等于 188：24 + 24 + 24 + 24 + 22 + 22 + 24 + 24。
 *
 * 每一关就是一组「尺寸 + 刺种数 + 附加机制 + 三星时限」。
 * 第 3 章（第 49 关）起一律走无猜生成：布好种之后要让约束求解器一路推到底，
 * 推不动就换一张，所以后面的关**不需要蒙**，全都能靠数字算出来。
 */
import { assertTotal, type Chapter } from "../level99";

export const CHAPTERS: Chapter[] = [
  { name: "小苗床", emoji: "🌱", color: "#EAF7DC", desc: "从 5×5 起步，刺种很少，先认识数字。", size: 24 },
  { name: "初级园", emoji: "🌿", color: "#E1F2E8", desc: "标准的 9×9 十颗刺种，把基本功练熟。", size: 24 },
  { name: "和弦课", emoji: "🎵", color: "#E6EEF9", desc: "旗插齐了就点数字，一次翻开一圈——不用和弦拿不到三星。", size: 24 },
  { name: "中级林", emoji: "🌳", color: "#E3EFDB", desc: "16×16 四十颗，地方大了要学会分区扫。", size: 24 },
  { name: "迷雾园", emoji: "🌫️", color: "#E9ECF4", desc: "只照亮光标周围 3×3，记住数字比看见更重要。", size: 22 },
  { name: "限时花期", emoji: "⏳", color: "#F6EEE0", desc: "花期有限，倒计时归零之前把地扫完。", size: 22 },
  { name: "高级田", emoji: "🌾", color: "#F1F0DC", desc: "一步步逼近 16×30 九十九颗的大田。", size: 24 },
  { name: "园丁杯", emoji: "🏆", color: "#F7E8EF", desc: "限时、限旗、迷雾轮着来，全是无猜的高密度大图。", size: 24 }
];

assertTotal(CHAPTERS, 188, "mine-garden");

/** 从第几关开始必须无猜（0 基）：第 3 章第一关 */
export const NO_GUESS_FROM = CHAPTERS[0].size + CHAPTERS[1].size;

export interface MineLevel {
  /** 0 基关号 */
  index: number;
  chapterIndex: number;
  w: number;
  h: number;
  mines: number;
  /** 这一关要不要无猜生成 */
  noGuess: boolean;
  /** 第一次踩到刺种有一次保护 */
  protect: boolean;
  /** 迷雾：只照亮光标周围 3×3 */
  fog: boolean;
  /** 限旗关的小旗上限；不限就是 undefined */
  flagLimit?: number;
  /** 倒计时（毫秒）；不限时就是 undefined */
  timeLimitMs?: number;
  /** 这一关摆明了要用和弦 */
  chordCourse: boolean;
  /** [三星时限, 二星时限]，单位毫秒 */
  starMs: readonly [number, number];
  title: string;
  task: string;
}

/** 密度：刺种数 / 格子数，用来给关卡表做体检 */
export function density(level: MineLevel): number {
  return level.mines / (level.w * level.h);
}

/** 在 a..b 之间按 i/(n-1) 线性取值并取整 */
function ramp(a: number, b: number, i: number, n: number): number {
  if (n <= 1) return Math.round(a);
  return Math.round(a + ((b - a) * i) / (n - 1));
}

/** 章节 ci 的第一关（0 基） */
function chapterStartIndex(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** 关号（0 基）→ 章节下标 */
export function chapterIndexOf(index: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (index < acc) return i;
  }
  return CHAPTERS.length - 1;
}

/**
 * 每格给多少毫秒。越靠后越紧，但从来不到「必须手忙脚乱」的地步；
 * 和弦课卡得最紧 —— 一格一格点是来不及的，只有用和弦才够快。
 */
function msPerCell(ci: number, chordCourse: boolean): number {
  if (chordCourse) return 260;
  const table = [900, 700, 260, 520, 620, 520, 460, 420];
  return table[ci] ?? 500;
}

const TASKS = [
  "把这片小苗床全部翻开，绕开刺种。",
  "标准园圃：看数字推刺种，把非刺种格全翻开。",
  "旗插齐了就点数字，一次翻开一圈，快点儿。",
  "地方大了，先扫开阔处，再啃边角。",
  "雾里只看得见光标周围，记住看过的数字。",
  "花期有限，倒计时归零之前扫完。",
  "大田开工，分成几块轮流推。",
  "园丁杯决赛：限时限旗还有雾，稳住。"
];

function levelName(ci: number, n: number): string {
  const names = ["小苗床", "初级园", "和弦课", "中级林", "迷雾园", "限时花期", "高级田", "园丁杯"];
  return `${names[ci]} 第 ${n} 畦`;
}

/** 造出第 index 关（0 基）。纯函数，同一关每次都长一样。 */
export function levelAt(index: number): MineLevel {
  const idx = Math.max(0, Math.min(187, Math.floor(index)));
  const ci = chapterIndexOf(idx);
  const start = chapterStartIndex(ci);
  const i = idx - start;
  const n = CHAPTERS[ci].size;

  let w = 9;
  let h = 9;
  let mines = 10;
  let fog = false;
  let flagLimit: number | undefined;
  let timeLimitMs: number | undefined;
  const chordCourse = ci === 2;
  const protect = ci <= 1;

  switch (ci) {
    case 0: {
      // 小苗床：5×5 一路长到 9×9，刺种极少
      const side = Math.min(9, 5 + Math.floor(i / 5));
      w = side;
      h = side;
      mines = Math.max(2, Math.round(side * side * 0.1) + Math.floor(i / 8));
      break;
    }
    case 1: {
      // 初级园：标准 9×9 / 10，后半段悄悄加一两颗
      w = 9;
      h = 9;
      mines = 10 + Math.floor(i / 12);
      break;
    }
    case 2: {
      // 和弦课：9×9 / 10×10，密度够高才有得和弦
      const side = i < 12 ? 9 : 10;
      w = side;
      h = side;
      mines = side === 9 ? ramp(10, 13, i, 12) : ramp(14, 18, i - 12, 12);
      break;
    }
    case 3: {
      // 中级林：16×16，刺种数一路走到 40
      w = 16;
      h = 16;
      mines = ramp(32, 40, i, n);
      break;
    }
    case 4: {
      // 迷雾园：图不大但看不见，密度压低一点
      w = ramp(10, 14, i, n);
      h = ramp(10, 12, i, n);
      mines = Math.round(w * h * 0.14) + Math.floor(i / 8);
      fog = true;
      break;
    }
    case 5: {
      // 限时花期：倒计时，尺寸中等
      w = ramp(12, 16, i, n);
      h = ramp(12, 16, i, n);
      mines = Math.round(w * h * 0.15);
      break;
    }
    case 6: {
      // 高级田：从 20×14 一路逼近 16×30 / 99，密度也跟着一点点往上走
      w = ramp(20, 30, i, n);
      h = ramp(14, 16, i, n);
      mines = ramp(45, 99, i, n);
      break;
    }
    default: {
      // 园丁杯：综合 + 高密度，三种附加机制轮着来
      w = ramp(18, 30, i, n);
      h = 16;
      mines = Math.round(w * h * (0.19 + (0.04 * i) / (n - 1)));
      if (i % 3 === 1) fog = true;
      if (i % 3 === 2) flagLimit = mines;
      break;
    }
  }

  const cells = w * h;
  const three = Math.round(cells * msPerCell(ci, chordCourse));
  const two = Math.round(three * 1.9);
  if (ci === 5) timeLimitMs = Math.round(three * 2.4);
  if (ci === 7 && i % 3 === 0) timeLimitMs = Math.round(three * 2.6);

  return {
    index: idx,
    chapterIndex: ci,
    w,
    h,
    mines,
    noGuess: idx >= NO_GUESS_FROM,
    protect,
    fog,
    flagLimit,
    timeLimitMs,
    chordCourse,
    starMs: [three, two] as const,
    title: levelName(ci, i + 1),
    task: TASKS[ci]
  };
}

/** 全 188 关（缓存一次，别每次都重算） */
let ALL: MineLevel[] | null = null;
export function allLevels(): MineLevel[] {
  if (!ALL) ALL = Array.from({ length: 188 }, (_, i) => levelAt(i));
  return ALL;
}

/** 每一关的布种种子：同一关每次打开难度相当，但换关就换图 */
export function levelSeed(index: number, retry = 0): number {
  return (Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(retry + 1, 0x85ebca6b)) >>> 0;
}

// ---------------------------------------------------------------------------
// 评星
// ---------------------------------------------------------------------------

/**
 * 按用时评星：`limits` 是 [三星时限, 二星时限]。
 * 用过保护（也就是踩到过一次刺种）最多两星 —— 三星留给一次都没踩的那一盘。
 */
export function starsByTime(ms: number, limits: readonly [number, number], usedProtect = false): 1 | 2 | 3 {
  const [three, two] = limits;
  if (!usedProtect && ms <= three) return 3;
  if (ms <= two) return 2;
  return 1;
}

/** 结算里那句话：只夸，不批评 */
export function winLine(level: MineLevel, stars: 1 | 2 | 3, ms: number): string {
  const sec = (ms / 1000).toFixed(1);
  if (stars === 3) return `${sec} 秒扫完，一颗刺种都没碰到，这片花园全开了！`;
  if (stars === 2) return `${sec} 秒扫完啦，再快一点点就是三星。`;
  return `扫完了！用了 ${sec} 秒，下次试试用和弦一次翻开一圈。`;
}

export function loseLine(reason: "hit" | "time"): string {
  return reason === "time"
    ? "花期到啦，这一片没扫完。下一次先挑数字小的地方下手。"
    : "碰到一颗刺种，它当场开了朵花。别急，回头看看那圈数字再来一次。";
}
