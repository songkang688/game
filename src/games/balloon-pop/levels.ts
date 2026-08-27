/**
 * 气球砰砰 · 188 关关卡表。
 * 前 99 关是 1.0 的六大天空，生成参数一个字都没动；
 * 1.1 在末尾追加四片新天空（第 100–188 关）：
 *  ⑦连锁峡谷=连锁气球波及一片  ⑧护盾高原=护盾气球要敲两下
 *  ⑨算式云梯=按算式得数 1→5 顺序戳  ⑩镜风山口=风向会左右翻面
 * 1.0 的六个主题章节、四种玩法模式（并非同一模板）：
 *  ①彩色广场=自由砰砰  ②颜色指令=只戳指定颜色  ③数字气球=按 1→5 顺序戳
 *  ④乌云闯入=乌云球不能戳  ⑤闪电风暴=飞得快+彩虹清屏  ⑥烟花之夜=全机关混合
 */
import type { Chapter } from "../level99";

/** 1.1 新增 "math"：气球上是算式，按得数顺序戳 */
export type BalloonMode = "free" | "color" | "number" | "math";

/** 1.0 的六片天空：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新天空从这里开始往后排） */
export const LEGACY_LEVELS = 99;

export interface BalloonLevel {
  /** 需要戳破的气球数 */
  target: number;
  /** 最多允许飘走几个该戳的气球 */
  escapes: number;
  /** 上升速度（像素/秒） */
  riseSpeed: number;
  spawnMs: number;
  mode: BalloonMode;
  /** 乌云球概率（不能戳） */
  cloudChance: number;
  /** 彩虹球概率（戳了清屏） */
  rainbowChance: number;
  /** 夜晚主题 */
  night: boolean;
  /** 1.1 连锁气球概率（戳破波及一片），前 99 关不带 */
  chainChance?: number;
  /** 1.1 护盾气球概率（要敲两下），前 99 关不带 */
  shieldChance?: number;
  /** 1.1 风力（每秒横向漂移的百分比），前 99 关不带 */
  wind?: number;
  /** 1.1 风向翻面周期（毫秒），前 99 关不带 */
  windFlipMs?: number;
  /** 1.2 礼物气球概率（不能戳，戳了扣分），前 99 关不带 */
  giftChance?: number;
  /** 1.2 双子气球概率（两个绑一起，戳一个一起爆），前 99 关不带 */
  twinChance?: number;
  /** 1.2 保护目标：一个礼物气球都不许飞走，前 99 关不带 */
  protect?: boolean;
}

export const CHAPTERS: Chapter[] = [
  { name: "彩色广场", emoji: "🎈", color: "#FFE0EC", desc: "气球飘上来就戳破它！", size: 17 },
  { name: "颜色指令", emoji: "🎯", color: "#FFF0C9", desc: "只能戳指定颜色的气球哦！", size: 17 },
  { name: "数字气球", emoji: "🔢", color: "#D6EBFF", desc: "按 1→2→3→4→5 的顺序戳！", size: 17 },
  { name: "乌云闯入", emoji: "☁️", color: "#E8E6F0", desc: "乌云球会捣乱，千万别戳它！", size: 16 },
  { name: "闪电风暴", emoji: "⚡", color: "#FFF6D8", desc: "气球飞得飞快，彩虹球能清屏！", size: 16 },
  { name: "烟花之夜", emoji: "🎆", color: "#DCD6F5", desc: "夜空下颜色指令+乌云一起来！", size: 16 },
  // ↓ 1.1 追加：四片新天空，合计 89 关
  { name: "连锁峡谷", emoji: "🧨", color: "#FFE4D6", desc: "连锁气球一响，身边的气球跟着一起炸！", size: 23 },
  { name: "护盾高原", emoji: "🛡️", color: "#DFF0E2", desc: "护盾气球要敲两下：先碎盾，再砰！", size: 22 },
  { name: "算式云梯", emoji: "🧮", color: "#E7ECFF", desc: "先算出气球上算式的得数，再按 1→5 顺序戳！", size: 22 },
  { name: "镜风山口", emoji: "🌀", color: "#F3E4FF", desc: "山口的风一会儿吹左一会儿吹右，看准再出手！", size: 22 }
];

function buildLevel(ci: number, t: number): BalloonLevel {
  switch (ci) {
    case 0:
      return {
        target: 10 + t, escapes: 4,
        riseSpeed: 55 + t * 3, spawnMs: 950 - t * 15,
        mode: "free", cloudChance: 0, rainbowChance: 0, night: false
      };
    case 1:
      return {
        target: 10 + Math.floor(t / 2), escapes: 5,
        riseSpeed: 55 + t * 3, spawnMs: 900 - t * 12,
        mode: "color", cloudChance: 0, rainbowChance: 0, night: false
      };
    case 2:
      return {
        target: 10 + Math.floor(t / 2), escapes: 6,
        riseSpeed: 50 + t * 3, spawnMs: 900 - t * 10,
        mode: "number", cloudChance: 0, rainbowChance: 0, night: false
      };
    case 3:
      return {
        target: 12 + t, escapes: 4,
        riseSpeed: 62 + t * 3, spawnMs: 820 - t * 10,
        mode: "free", cloudChance: 0.2 + t * 0.008, rainbowChance: 0, night: false
      };
    case 4:
      return {
        target: 15 + t, escapes: 5,
        riseSpeed: 85 + t * 4, spawnMs: 700 - t * 10,
        mode: "free", cloudChance: 0.1, rainbowChance: 0.08, night: false
      };
    case 5:
      return {
        target: 12 + Math.floor(t / 2), escapes: 5,
        riseSpeed: 70 + t * 4, spawnMs: 760 - t * 10,
        mode: t % 2 === 0 ? "color" : "number", cloudChance: 0.14, rainbowChance: 0.05, night: true
      };
    case 6:
      // 连锁峡谷：连锁气球越来越多，末段还混进乌云；1.2 起后半段加双子气球
      return {
        target: 14 + t, escapes: 5,
        riseSpeed: 60 + t * 2, spawnMs: 780 - t * 8,
        mode: "free", cloudChance: t >= 12 ? 0.1 : 0, rainbowChance: 0, night: false,
        chainChance: 0.12 + t * 0.004,
        twinChance: t >= 10 ? 0.12 : 0
      };
    case 7:
      // 护盾高原：护盾气球要敲两下，偶尔换成颜色指令；1.2 起中段起送礼物气球
      return {
        target: 12 + Math.floor(t / 2), escapes: 5,
        riseSpeed: 58 + t * 2, spawnMs: 800 - t * 8,
        mode: t % 3 === 2 ? "color" : "free", cloudChance: 0.08, rainbowChance: 0, night: false,
        shieldChance: 0.25 + t * 0.008,
        giftChance: t >= 6 ? 0.08 : 0
      };
    case 8:
      // 算式云梯：气球上写算式，按得数 1→5 顺序戳
      return {
        target: 10 + Math.floor(t / 2), escapes: 6,
        riseSpeed: 52 + t * 2, spawnMs: 900 - t * 8,
        mode: "math", cloudChance: 0, rainbowChance: t >= 10 ? 0.04 : 0, night: false
      };
    default:
      // 镜风山口：风向定期翻面 + 前面机关轮番客串；
      // 1.2 起每三关来一关「保护关」：礼物气球一个都不许被风吹跑
      // 收尾这一章的坡要压得比第 8 章更陡：末章的自由关原来只紧到 0.8 秒一下，
      // 比第 8 章的 0.6 秒还松，末章反而成了喘气的地方（W4A-14）。
      return {
        target: 13 + Math.floor(t / 2), escapes: 5,
        riseSpeed: 62 + Math.round(t * 2.6), spawnMs: 780 - t * 10,
        mode: t % 2 === 0 ? "free" : "color", cloudChance: 0.1, rainbowChance: 0.04,
        night: t >= 11,
        wind: 6 + t * 0.5, windFlipMs: 4200 - t * 80,
        chainChance: t >= 8 ? 0.06 : 0, shieldChance: t >= 14 ? 0.1 : 0,
        giftChance: t >= 4 ? 0.08 : 0,
        twinChance: t >= 6 ? 0.1 : 0,
        protect: t >= 4 && t % 3 === 1
      };
  }
}

export const LEVELS: BalloonLevel[] = (() => {
  const out: BalloonLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();

// ---------------------------------------------------------------------------
// 1.1 算式云梯的口算题生成（纯函数，可测试）
// ---------------------------------------------------------------------------

/**
 * 给 1..9 的得数配一道口算题（＋−×÷ 里挑一种，六年级口算量级）。
 * 保证：题面只有「数字 运算符 数字」，算出来恰好等于 value。
 */
export function mathExprFor(value: number, rand: () => number): string {
  const ops: string[] = ["-", "÷"];
  if (value >= 2) ops.push("+");
  const factors: Array<[number, number]> = [];
  for (let a = 2; a * a <= value; a++) {
    if (value % a === 0) factors.push([a, value / a]);
  }
  if (factors.length > 0) ops.push("×");
  const op = ops[Math.floor(rand() * ops.length)];
  if (op === "+") {
    const a = 1 + Math.floor(rand() * (value - 1));
    return `${a}+${value - a}`;
  }
  if (op === "-") {
    const b = 1 + Math.floor(rand() * 9);
    return `${value + b}-${b}`;
  }
  if (op === "×") {
    const [a, b] = factors[Math.floor(rand() * factors.length)];
    return rand() < 0.5 ? `${a}×${b}` : `${b}×${a}`;
  }
  const b = 2 + Math.floor(rand() * 5);
  return `${value * b}÷${b}`;
}

/** 口算求值（测试与冒烟脚本用）：只认「a 运算符 b」 */
export function evalMathExpr(expr: string): number {
  const m = /^(\d+)([+\-×÷])(\d+)$/.exec(expr);
  if (!m) return NaN;
  const a = Number(m[1]);
  const b = Number(m[3]);
  switch (m[2]) {
    case "+": return a + b;
    case "-": return a - b;
    case "×": return a * b;
    default: return b === 0 ? NaN : a / b;
  }
}
