/**
 * 地鼠嘭嘭 · 188 关关卡表。
 * 前 99 关是 1.0 的六大乐园，生成参数一个字都没动；
 * 1.1 在末尾追加四片新地洞（第 100–188 关）：
 *  ⑦算术地洞=地鼠举算式牌，只拍得数对得上的  ⑧连击训练场=连击槽满进入嘭嘭时间
 *  ⑨铁盔地鼠营=护盾鼠要连打两下  ⑩月夜手电筒=夜视关，只有月光圈里看得清
 * 1.0 的六个主题章节、六种地鼠组合（并非同一模板）：
 *  ①草地新手=普通地鼠  ②瞌睡午后=瞌睡地鼠待得久
 *  ③闪电竞技=地鼠冒头飞快  ④金矿乐园=金地鼠一只顶两只
 *  ⑤小兔保护区=千万别拍小兔子  ⑥地鼠嘉年华=全员出动终极挑战
 */
import type { Chapter } from "../level99";

/** 1.0 的六片地洞：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新地洞从这里开始往后排） */
export const LEGACY_LEVELS = 99;

export interface MoleLevel {
  /** 本关时长（秒） */
  duration: number;
  /** 需要拍中的分数（普通/瞌睡=1 分，金地鼠=2 分） */
  target: number;
  /** 地鼠冒头停留时间范围（毫秒） */
  upMsMin: number;
  upMsMax: number;
  /** 两次冒头的间隔（毫秒） */
  gapMs: number;
  /** 同时最多几只 */
  maxConcurrent: number;
  goldChance: number;
  bunnyChance: number;
  sleepyChance: number;
  /** 1.1 出题地鼠占比（举算式牌，只拍得数等于目标数的那只），前 99 关不带 */
  quizChance?: number;
  /** 1.1 连击槽长度：连着拍中这么多只就进入嘭嘭时间，前 99 关不带 */
  comboTarget?: number;
  /** 1.1 嘭嘭时间持续多久（毫秒），前 99 关不带 */
  comboMs?: number;
  /** 1.1 护盾鼠占比（戴头盔，要连打两下），前 99 关不带 */
  shieldChance?: number;
  /** 1.1 夜视关：地洞一片漆黑，只有月光圈里看得清，前 99 关不带 */
  night?: boolean;
  /** 1.1 月光圈换位置的周期（毫秒），前 99 关不带 */
  torchMs?: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "草地新手", emoji: "🌱", color: "#E4F3D4", desc: "地鼠冒头就拍它，练练手速！", size: 17 },
  { name: "瞌睡午后", emoji: "😴", color: "#FFF0C9", desc: "瞌睡地鼠待得久，别被它骗了节奏！", size: 17 },
  { name: "闪电竞技", emoji: "⚡", color: "#FFE9D6", desc: "地鼠冒头飞快，眼疾手快才行！", size: 17 },
  { name: "金矿乐园", emoji: "🌟", color: "#FFF6D8", desc: "金地鼠一只顶两只，专挑亮的拍！", size: 16 },
  { name: "小兔保护区", emoji: "🐰", color: "#FFE0EC", desc: "小兔子会混进来，千万别拍它！", size: 16 },
  { name: "地鼠嘉年华", emoji: "🎪", color: "#EBDFFB", desc: "金地鼠、小兔、闪电速度全都来啦！", size: 16 },
  // ↓ 1.1 追加：四片新地洞，合计 89 关
  { name: "算术地洞", emoji: "🧮", color: "#E7ECFF", desc: "地鼠举着算式牌，只拍得数等于目标数的那一只！", size: 23 },
  { name: "连击训练场", emoji: "🔥", color: "#FFE4D6", desc: "连着拍中攒连击，连击槽满就进入嘭嘭时间！", size: 22 },
  { name: "铁盔地鼠营", emoji: "🛡️", color: "#DFF0E2", desc: "戴头盔的地鼠要连打两下：先掀盔，再嘭！", size: 22 },
  { name: "月夜手电筒", emoji: "🔦", color: "#DCD8F0", desc: "地洞一片漆黑，跟着巡游的月光圈找地鼠！", size: 22 }
];

function buildLevel(ci: number, t: number): MoleLevel {
  switch (ci) {
    case 0:
      return {
        duration: 30, target: 8 + Math.floor(t / 2),
        upMsMin: 1250 - t * 20, upMsMax: 1700 - t * 20,
        gapMs: 800 - t * 10, maxConcurrent: t < 9 ? 1 : 2,
        goldChance: 0, bunnyChance: 0, sleepyChance: 0
      };
    case 1:
      return {
        duration: 32, target: 10 + Math.floor(t / 2),
        upMsMin: 1000 - t * 15, upMsMax: 1500 - t * 15,
        gapMs: 750 - t * 10, maxConcurrent: 2,
        goldChance: 0, bunnyChance: 0, sleepyChance: 0.35
      };
    case 2:
      return {
        duration: 30, target: 11 + Math.floor(t / 2),
        upMsMin: 700 - t * 12, upMsMax: 1050 - t * 12,
        gapMs: 620 - t * 10, maxConcurrent: 2,
        goldChance: 0, bunnyChance: 0, sleepyChance: 0
      };
    case 3:
      return {
        duration: 32, target: 14 + Math.floor(t / 2),
        upMsMin: 850 - t * 10, upMsMax: 1250 - t * 10,
        gapMs: 600 - t * 8, maxConcurrent: 2,
        goldChance: 0.25, bunnyChance: 0, sleepyChance: 0
      };
    case 4:
      return {
        duration: 32, target: 12 + Math.floor(t / 2),
        upMsMin: 850 - t * 10, upMsMax: 1300 - t * 10,
        gapMs: 620 - t * 8, maxConcurrent: 2,
        goldChance: 0, bunnyChance: 0.2 + t * 0.006, sleepyChance: 0
      };
    case 5:
      return {
        duration: 34, target: 15 + Math.floor(t / 2),
        upMsMin: 700 - t * 8, upMsMax: 1050 - t * 8,
        gapMs: 540 - t * 8, maxConcurrent: 3,
        goldChance: 0.18, bunnyChance: 0.16, sleepyChance: 0.15
      };
    case 6:
      // 算术地洞：全场都是举算式牌的地鼠，拍错只掉一颗心，节奏放慢好让人算
      return {
        duration: 36, target: 8 + Math.floor(t / 3),
        upMsMin: 1500 - t * 12, upMsMax: 2100 - t * 12,
        gapMs: 900 - t * 8, maxConcurrent: t >= 12 ? 3 : 2,
        goldChance: 0, bunnyChance: 0, sleepyChance: 0,
        quizChance: 1
      };
    case 7:
      // 连击训练场：连击槽越来越长，小兔子越来越爱来打断连击
      return {
        duration: 34, target: 16 + Math.floor(t / 2),
        upMsMin: 780 - t * 8, upMsMax: 1150 - t * 8,
        gapMs: 640 - t * 6, maxConcurrent: t >= 11 ? 3 : 2,
        goldChance: 0.1, bunnyChance: 0.12 + t * 0.004, sleepyChance: 0,
        comboTarget: 4 + Math.floor(t / 6), comboMs: 5000 + t * 80
      };
    case 8:
      // 铁盔地鼠营：护盾鼠越来越多，一只算两分，值得多敲一下
      return {
        duration: 36, target: 14 + Math.floor(t / 2),
        upMsMin: 1000 - t * 10, upMsMax: 1450 - t * 10,
        gapMs: 700 - t * 8, maxConcurrent: t >= 12 ? 3 : 2,
        goldChance: 0.08, bunnyChance: 0.1, sleepyChance: 0,
        shieldChance: 0.3 + t * 0.008
      };
    default:
      // 月夜手电筒：全章漆黑，月光圈越转越快，后半段把连击槽和铁盔一起请回来
      return {
        duration: 36, target: 12 + Math.floor(t / 2),
        upMsMin: 1150 - t * 10, upMsMax: 1600 - t * 10,
        gapMs: 780 - t * 8, maxConcurrent: t >= 14 ? 3 : 2,
        goldChance: 0.14, bunnyChance: t >= 8 ? 0.12 : 0, sleepyChance: 0.12,
        night: true, torchMs: 2600 - t * 40,
        comboTarget: t >= 10 ? 5 : undefined, comboMs: t >= 10 ? 5200 : undefined,
        shieldChance: t >= 15 ? 0.12 : undefined
      };
  }
}

export const LEVELS: MoleLevel[] = (() => {
  const out: MoleLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();

// ---------------------------------------------------------------------------
// 1.1 算术地洞的出题（纯函数，可测试）
// ---------------------------------------------------------------------------

/** 一只出题地鼠举着的牌子：题面 + 它算出来的得数 + 是不是本轮要拍的那只 */
export interface QuizCard {
  expr: string;
  value: number;
  correct: boolean;
}

/**
 * 本轮要拍的目标得数：章节越靠后数越大，但始终留在 2..20，够六年级口算。
 */
export function quizTarget(t: number, rand: () => number): number {
  const hi = Math.min(20, 8 + t);
  return 2 + Math.floor(rand() * (hi - 1));
}

/**
 * 给一个得数配一道口算题（＋−×÷ 里挑一种）。
 * 保证：题面只有「数字 运算符 数字」，算出来恰好等于 value。
 */
export function quizExprFor(value: number, rand: () => number): string {
  const ops: string[] = ["-"];
  if (value >= 2) ops.push("+");
  const factors: Array<[number, number]> = [];
  for (let a = 2; a * a <= value; a++) {
    if (value % a === 0) factors.push([a, value / a]);
  }
  if (factors.length > 0) ops.push("×");
  if (value <= 12) ops.push("÷");
  const op = ops[Math.floor(rand() * ops.length)];
  if (op === "+") {
    const a = 1 + Math.floor(rand() * (value - 1));
    return `${a}+${value - a}`;
  }
  if (op === "×") {
    const [a, b] = factors[Math.floor(rand() * factors.length)];
    return rand() < 0.5 ? `${a}×${b}` : `${b}×${a}`;
  }
  if (op === "÷") {
    const b = 2 + Math.floor(rand() * 4);
    return `${value * b}÷${b}`;
  }
  const b = 1 + Math.floor(rand() * 9);
  return `${value + b}-${b}`;
}

/** 口算求值（测试与冒烟脚本用）：只认「a 运算符 b」 */
export function evalQuizExpr(expr: string): number {
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

/**
 * 生成一只出题地鼠的牌子。
 * correct=true 时得数正好是 target；否则挑一个 2..20 里不等于 target 的干扰得数。
 */
export function buildQuizCard(target: number, correct: boolean, rand: () => number): QuizCard {
  if (correct) {
    return { expr: quizExprFor(target, rand), value: target, correct: true };
  }
  let value = 2 + Math.floor(rand() * 19);
  let guard = 0;
  while (value === target && guard++ < 40) value = 2 + Math.floor(rand() * 19);
  if (value === target) value = target === 2 ? 3 : target - 1;
  return { expr: quizExprFor(value, rand), value, correct: false };
}

// ---------------------------------------------------------------------------
// 1.1 无尽地鼠场（纯函数，可测试）
// ---------------------------------------------------------------------------

/** 无尽地鼠场每一波的名字：每 5 波换一片场地，读起来有「越挖越深」的感觉 */
export const ENDLESS_FIELDS = ["草坡地洞", "石板地洞", "萤火地洞", "冰霜地洞", "熔岩地洞"];

/** 无尽地鼠场第 wave 波（1 基）的场地名 */
export function endlessFieldName(wave: number): string {
  const n = Math.max(1, Math.round(wave) || 1);
  return ENDLESS_FIELDS[Math.min(ENDLESS_FIELDS.length - 1, Math.floor((n - 1) / 5))];
}

/**
 * 无尽地鼠场第 wave 波（1 基）的配置：越来越快、机关轮番上场，
 * 但速度、并发和目标分都有封顶，不会变成「不可能完成」。
 */
export function endlessWave(wave: number): MoleLevel {
  const n = Math.max(1, Math.round(wave) || 1);
  const k = Math.min(n - 1, 24);
  return {
    duration: 20,
    target: 6 + Math.floor(k / 2),
    upMsMin: Math.max(430, 1200 - k * 30),
    upMsMax: Math.max(760, 1650 - k * 32),
    gapMs: Math.max(330, 820 - k * 20),
    maxConcurrent: n >= 9 ? 3 : n >= 4 ? 2 : 1,
    goldChance: 0.14,
    bunnyChance: n >= 3 ? 0.14 : 0,
    sleepyChance: 0.1,
    shieldChance: n >= 6 ? 0.18 : 0,
    comboTarget: 4,
    comboMs: 5000,
    night: n % 5 === 0,
    torchMs: 2200
  };
}

/** 无尽地鼠场收摊时的一句话（只鼓励，不批评） */
export function endlessLine(wave: number, best: number): string {
  if (wave <= 0) return "第一波还没站稳，热热身再来一次，手速马上就跟上了！";
  if (wave > best) return `新纪录！你一口气守住了 ${wave} 波地洞！`;
  return `这次守住 ${wave} 波，最好成绩是 ${best} 波，再来一次准能追上！`;
}
