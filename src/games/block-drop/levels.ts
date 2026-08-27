/**
 * 方块叠叠乐 · 188 关战役配置(纯数据 + 纯函数)。
 * 八章把落块的技术点一个一个拆开教:先熟悉落块,再七块齐全,
 * 然后暂存、踢墙、满四行、小凸转身、连击,最后残局杯。
 *
 * 每一关都给一块固定的初始堆形和一个固定的出块 seed,
 * 所以「这一关有没有解」是可以用求解器一关一关跑出来的。
 */
import { TOTAL_LEVELS, type Chapter } from "../level99";
import { COLS, buildBoard, createBoard, type Board } from "./board";
import { PIECE_IDS, type PieceId } from "./pieces";
import { MAX_LEVEL } from "./score";
import type { AiTier } from "./ai";

export const CHAPTERS: Chapter[] = [
  { name: "落块入门", emoji: "🧱", color: "#DCE9FB", desc: "只出三种好摆的块,先把左右挪和旋转摸熟。", size: 24 },
  { name: "七块齐全", emoji: "🎨", color: "#E9E1FB", desc: "七种块全上场,学会给每一种块找位置。", size: 24 },
  { name: "暂存课", emoji: "📦", color: "#FBE3EE", desc: "把不好用的块先存起来,换一个顺手的。", size: 24 },
  { name: "踢墙课", emoji: "🧩", color: "#DFF5DC", desc: "贴着墙转一下,块会自己挪进窄缝里。", size: 24 },
  { name: "满四行", emoji: "🌟", color: "#FDF3D2", desc: "留一口井,攒够四行再用长条一次消掉。", size: 22 },
  { name: "小凸转身", emoji: "🌀", color: "#D8EFF2", desc: "小凸块靠转身塞进屋檐下面,分数特别高。", size: 22 },
  { name: "连击工坊", emoji: "✨", color: "#F7DDE8", desc: "一块接一块地消,连击越长分越多。", size: 24 },
  { name: "叠叠杯", emoji: "🏆", color: "#FDE7D6", desc: "块数有限、落得又快,把学过的全用上。", size: 24 }
];

/** 每一关想教的那一手 */
export type SkillGoal = "none" | "hold" | "kick" | "quad" | "tspin" | "combo";

export interface DropLevel {
  /** 0 基关号 */
  level: number;
  /** 固定出块 seed:同一关每次的出块顺序都一样 */
  seed: number;
  /** 要消掉几行才算过 */
  targetLines: number;
  /** 最多能用几个块 */
  pieceBudget: number;
  /** 起手重力等级 */
  startLevel: number;
  /** 这一关只出这几种块 */
  bag: PieceId[];
  /** 第三颗星要打出的那一手(不影响能不能过关) */
  skill: SkillGoal;
  /** 连击类关卡要求的连击长度 */
  comboTarget: number;
  /** 章节下标 */
  chapter: number;
}

/** 关号 → 章节下标 */
export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

const SKILL_BY_CHAPTER: SkillGoal[] = ["none", "none", "hold", "kick", "quad", "tspin", "combo", "quad"];

/** 入门章只出这三种好摆的块 */
export const STARTER_BAG: PieceId[] = ["O", "I", "L"];

export function levelConfig(level: number): DropLevel {
  const lv = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(Number.isFinite(level) ? level : 0)));
  const ci = chapterIndexOf(lv);
  const inCh = lv - CHAPTERS.slice(0, ci).reduce((s, c) => s + c.size, 0);
  const ramp = inCh / Math.max(1, CHAPTERS[ci].size - 1);

  const baseLines = [3, 5, 4, 4, 4, 3, 4, 6][ci];
  const extraLines = [1, 3, 2, 2, 4, 3, 4, 6][ci];
  const targetLines = baseLines + Math.round(ramp * extraLines);

  return {
    level: lv,
    seed: 7000 + lv * 131,
    targetLines,
    pieceBudget: 16 + ci * 3 + Math.round(ramp * 8) + targetLines * 2,
    startLevel: Math.min(MAX_LEVEL, Math.floor(ci * 1.2 + ramp * 2)),
    bag: ci === 0 ? [...STARTER_BAG] : [...PIECE_IDS],
    skill: SKILL_BY_CHAPTER[ci],
    comboTarget: ci === 6 ? 2 + Math.round(ramp * 2) : 0,
    chapter: ci
  };
}

/**
 * 每一关的初始堆形。
 * 前两章是空场地,后面按这一章要教的东西预先摆好局面:
 * 要练满四行就先给一口四格深的井,要练转身就先搭好屋檐。
 */
export function startBoard(level: number): Board {
  const cfg = levelConfig(level);
  const ci = cfg.chapter;
  const inCh = cfg.level - CHAPTERS.slice(0, ci).reduce((s, c) => s + c.size, 0);
  const all = Array.from({ length: COLS }, (_, i) => i);

  switch (ci) {
    case 0:
    case 1:
      return createBoard();
    case 2: {
      // 暂存课:摆一条只有细块进得去的沟,手上的块不合适就先存起来
      const gap = 2 + (inCh % 6);
      return buildBoard([[gap], [gap], [gap, gap + 1]]);
    }
    case 3: {
      // 踢墙课:屋檐下面留一条窄缝,直着掉进不去,得贴墙转一下
      const gap = 1 + (inCh % 7);
      return buildBoard([[gap], [gap], all.filter((c) => c !== gap + 1)]);
    }
    case 4:
    case 7: {
      // 满四行 / 叠叠杯:先给一口四格深的井,长条插进去就是满四行
      const well = ci === 7 ? 9 - (inCh % 2) : (inCh % 2 === 0 ? 9 : 0);
      const rows = [[well], [well], [well], [well]];
      if (ci === 7) rows.push([well, (well + 3) % COLS]);
      return buildBoard(rows);
    }
    case 5: {
      // 小凸转身:一个屋檐 + 下面的凹槽,小凸块只能转着塞进去
      const c = 2 + (inCh % 5);
      return buildBoard([[c], [c - 1, c, c + 1], all.filter((x) => x !== c - 1)]);
    }
    default: {
      // 连击工坊:一级一级的台阶,一块接一块地消
      const step = inCh % 3;
      return buildBoard([[8, 9], [8, 9], [6 + step, 7 + step, 8, 9], [4, 5, 6 + step, 7 + step, 8, 9]]);
    }
  }
}

/** 三星:达标一星,超额 / 打出这一章要教的那一手再加星 */
export function starsFor(
  cfg: DropLevel,
  got: { lines: number; used: number; skillDone: boolean; bestCombo: number }
): 1 | 2 | 3 {
  if (got.lines < cfg.targetLines) return 1;
  const skill = cfg.skill === "combo" ? got.bestCombo >= cfg.comboTarget : got.skillDone;
  const thrifty = got.used <= Math.round(cfg.pieceBudget * 0.7);
  if (skill && thrifty) return 3;
  if (skill || thrifty) return 2;
  return 1;
}

const SKILL_TEXT: Record<SkillGoal, string> = {
  none: "",
  hold: "用一次暂存能拿第三颗星",
  kick: "靠踢墙塞进窄缝能拿第三颗星",
  quad: "一次消四行能拿第三颗星",
  tspin: "打出小凸转身能拿第三颗星",
  combo: "连击够长能拿第三颗星"
};

/** 关卡目标写成一句话 */
export function goalLine(cfg: DropLevel): string {
  const parts = [`消 ${cfg.targetLines} 行`, `最多 ${cfg.pieceBudget} 块`];
  const skill = cfg.skill === "combo" ? `连击 ${cfg.comboTarget} 次能拿第三颗星` : SKILL_TEXT[cfg.skill];
  if (skill) parts.push(skill);
  return parts.join(" · ");
}

/** 这一关算不算过 */
export function levelWon(cfg: DropLevel, got: { lines: number; toppedOut: boolean }): boolean {
  if (got.toppedOut) return false;
  return got.lines >= cfg.targetLines;
}

// ---------------------------------------------------------------------------
// 无尽:马拉松 + 40 行竞速
// ---------------------------------------------------------------------------

export type EndlessKind = "marathon" | "sprint";

export interface EndlessConfig {
  kind: EndlessKind;
  startLevel: number;
  /** 竞速要消满多少行 */
  targetLines: number;
  bag: PieceId[];
}

export function endlessConfig(kind: EndlessKind): EndlessConfig {
  return {
    kind,
    startLevel: 0,
    targetLines: kind === "sprint" ? 40 : 0,
    bag: [...PIECE_IDS]
  };
}

// ---------------------------------------------------------------------------
// 对战
// ---------------------------------------------------------------------------

export interface VersusConfig {
  tier: AiTier;
  startLevel: number;
}

export function versusConfig(tier: AiTier): VersusConfig {
  return { tier, startLevel: tier === "hell" ? 4 : tier === "pro" ? 2 : 0 };
}
