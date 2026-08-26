/**
 * 雪球大作战 · 188 关闯关(8 大章节)与另外三种模式的场地。
 *
 * 每一关都由同一颗种子确定生成:靶子的站位、掩体、风的安排、雪球数量,
 * 同一关每次进去都一模一样。生成完还会保证「一定打得完」——
 * 雪球数量至少是靶子数的两倍,雪怪也留足了走过来的回合数。
 */
import type { Chapter } from "../level99";
import { mulberry32 } from "../level99";
import { MAX_WIND } from "./physics";
import { GUARD_X, type CoverSpec, type MatchSpec, type TargetSpec } from "./logic";
import type { AiLevel } from "./physics";

export const CHAPTERS: Chapter[] = [
  {
    name: "初雪小院",
    emoji: "⛄",
    color: "#e9f3fe",
    desc: "没有风的院子,先把蓄力条练熟:拉得越满,雪球飞得越远。",
    size: 22,
  },
  {
    name: "风车山坡",
    emoji: "🌬️",
    color: "#e2eefb",
    desc: "山坡上开始起风,顺风收力、逆风加力。",
    size: 23,
  },
  {
    name: "冰砖矮墙",
    emoji: "🧱",
    color: "#e7edf7",
    desc: "冰砖掩体挡在中间:要么抬高角度越过去,要么多砸两下拆掉它。",
    size: 23,
  },
  {
    name: "雪墙工坊",
    emoji: "🏗️",
    color: "#eef2fa",
    desc: "雪怪会一步步走过来,学会自己堆雪墙先拖住它。",
    size: 22,
  },
  {
    name: "阵风谷",
    emoji: "🌀",
    color: "#e3edfb",
    desc: "山谷里的风每回合都在换,出手前一定先看风标。",
    size: 22,
  },
  {
    name: "移动靶场",
    emoji: "🎯",
    color: "#f0eaff",
    desc: "靶子会左右滑动,要瞄它待会儿到的地方。",
    size: 22,
  },
  {
    name: "雪怪营地",
    emoji: "👹",
    color: "#ecf5e9",
    desc: "雪怪成群结队地来,先打最靠近雪堡的那一个。",
    size: 26,
  },
  {
    name: "极光决赛",
    emoji: "🌌",
    color: "#f2eaf7",
    desc: "强风、掩体、会滑的靶子和雪怪一起上,把学过的全用上。",
    size: 28,
  },
];

export const LEVEL_TOTAL = 188;

/** 每章第一次出现的新东西,关卡头部会写出来 */
export const CHAPTER_NEW: readonly string[] = [
  "先练蓄力条:松手那一下的位置就是力度。",
  "起风了:顺风收一点力,逆风加一点力。",
  "冰砖掩体登场:抬高角度越过去,或者砸碎它。",
  "雪怪会走过来:按 G / K 堆一堵雪墙先拖住它。",
  "风每回合都会变,出手前先看风标。",
  "靶子会左右滑动,要打提前量。",
  "雪怪成群:先打最靠近雪堡的那一个。",
  "强风 + 掩体 + 会滑的靶子,全都用上。",
];

export interface SnowLevel {
  index: number;
  chapterIndex: number;
  /** 这一关给几个雪球 */
  balls: number;
  /** 能堆几堵雪墙 */
  walls: number;
  windPlan: number[];
  covers: CoverSpec[];
  targets: TargetSpec[];
}

export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

export function chapterStartOf(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** 投手站的位置(闯关与无尽都在左边) */
export const THROWER_X = 6;
/**
 * 靶子只会落在这一段里。
 * 右边留了一大截空白不用:最远的靶子要能用七八成力打到,顶大风的时候也一样。
 */
export const TARGET_MIN_X = 24;
export const TARGET_MAX_X = 48;
/** 闯关与无尽的画面只画到这里(右边那截空地不用画) */
export const VIEW_W = 54;

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** 这一关有几个靶子 */
export function targetCount(index: number): number {
  const ci = chapterIndexOf(index);
  const ii = index - chapterStartOf(ci);
  return Math.min(6, 1 + Math.floor(ci * 0.7) + Math.floor(ii / 8));
}

/** 这一关有几个是雪怪(会往雪堡走的那种) */
export function monsterCount(index: number): number {
  const ci = chapterIndexOf(index);
  if (ci < 3) return 0;
  const ii = index - chapterStartOf(ci);
  if (ci === 3) return 1 + (ii >= 11 ? 1 : 0);
  if (ci === 6) return Math.min(4, 2 + Math.floor(ii / 9));
  if (ci === 7) return Math.min(3, 1 + Math.floor(ii / 10));
  return 1;
}

/** 这一关的风怎么安排:空数组表示全程无风 */
export function buildWind(index: number): number[] {
  const ci = chapterIndexOf(index);
  const rand = mulberry32(4441 + index * 7717);
  if (ci === 0) return [0];
  const strength = (): number => {
    const base = ci >= 7 ? 1.2 + rand() * (MAX_WIND - 1.2) : ci >= 4 ? 0.7 + rand() * 1.6 : 0.5 + rand() * 1.3;
    return round1(rand() < 0.5 ? -base : base);
  };
  if (ci === 4 || ci === 7) {
    // 阵风:每一投都可能换一个风
    return [strength(), strength(), strength(), strength(), strength()];
  }
  return [strength()];
}

/**
 * 掩体离靶子至少要留这么宽的空档。
 * 留窄了就会出现「掩体正好糊在靶子脸上」的关:雪球从上面掉下来的路被自己挡死,
 * 那一关就成了死局。留出这段距离,抬高角度总能绕过去。
 */
export const COVER_CLEARANCE = 4.6;
/** 掩体最矮 / 最高 */
export const COVER_MIN_H = 3.4;

/**
 * 把掩体摆进「靶子之间的空档」里。
 * 先按靶子把整条场地切成几段空档,每次挑最宽的那一段放一堵,放完再把这段一分为二。
 * 放不下就少放一堵——宁可这一关掩体少,也不要摆出打不着的靶子。
 */
function placeCovers(
  rand: () => number,
  ci: number,
  want: number,
  targetXs: number[]
): CoverSpec[] {
  if (want <= 0) return [];
  const minGap = 3;
  const gaps: Array<[number, number]> = [];
  // 掩体不摆在雪堡警戒线以内:那儿是雪怪冲过来的地方,挡在那里等于帮倒忙
  let left = GUARD_X + 1.6;
  for (const tx of [...targetXs].sort((a, b) => a - b)) {
    if (tx - COVER_CLEARANCE - left >= minGap) gaps.push([left, tx - COVER_CLEARANCE]);
    left = Math.max(left, tx + COVER_CLEARANCE);
  }
  const out: CoverSpec[] = [];
  for (let i = 0; i < want; i++) {
    gaps.sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
    const gap = gaps[0];
    if (!gap || gap[1] - gap[0] < minGap) break;
    gaps.shift();
    const room = gap[1] - gap[0];
    const w = round1(Math.min(room - 0.8, 2 + rand() * 2.2));
    const x = round1(gap[0] + (room - w) * (0.15 + rand() * 0.7));
    out.push({
      x,
      w,
      h: round1(COVER_MIN_H + rand() * (ci >= 6 ? 3.1 : 2.4)),
      hp: 2 + (ci >= 5 ? 1 : 0),
      kind: "ice",
    });
    if (x - 1.4 - gap[0] >= minGap) gaps.push([gap[0], x - 1.4]);
    if (gap[1] - (x + w + 1.4) >= minGap) gaps.push([x + w + 1.4, gap[1]]);
  }
  return out.sort((a, b) => a.x - b.x);
}

export function buildLevel(index: number): SnowLevel {
  const clamped = Math.max(0, Math.min(LEVEL_TOTAL - 1, Math.round(index)));
  const ci = chapterIndexOf(clamped);
  const ii = clamped - chapterStartOf(ci);
  const rand = mulberry32(8123 + clamped * 31337);

  const total = targetCount(clamped);
  const monsters = Math.min(total, monsterCount(clamped));
  const swayOn = ci === 5 || ci === 7;

  const targets: TargetSpec[] = [];
  const span = TARGET_MAX_X - TARGET_MIN_X;
  for (let i = 0; i < total; i++) {
    const slot = total === 1 ? 0.5 : i / (total - 1);
    const x = round1(TARGET_MIN_X + slot * span + (rand() * 2 - 1) * 1.6);
    const isMonster = i < monsters;
    targets.push({
      x: Math.max(TARGET_MIN_X - 1, Math.min(TARGET_MAX_X + 1, x)),
      y: round1(1.6 + rand() * (ci >= 2 ? 5.5 : 2.2)),
      r: isMonster ? 1.3 : 1.15,
      kind: isMonster ? "monster" : "lantern",
      march: isMonster ? round1(0.8 + Math.min(1.2, ci * 0.12) + rand() * 0.3) : 0,
      sway: swayOn && !isMonster ? round1(1.2 + rand() * 2.2) : 0,
      swaySpeed: round1(0.4 + rand() * 0.4),
    });
  }

  const want = ci < 2 ? 0 : ci >= 7 ? 2 + (ii % 2) : ci >= 4 ? 1 + (ii % 2) : 1;
  const covers = placeCovers(rand, ci, want, targets.map((t) => t.x));

  // 雪球给足:每个靶子按三个雪球算,后面章节稍微紧一点,但不会到「打不完」
  const perTarget = ci >= 6 ? 2.6 : ci >= 3 ? 2.8 : 3.2;
  const balls = Math.max(4, Math.round(total * perTarget) + (ci >= 2 ? 1 : 2));

  return {
    index: clamped,
    chapterIndex: ci,
    balls,
    walls: ci >= 3 ? Math.min(3, 1 + Math.floor(ci / 3)) : 0,
    windPlan: buildWind(clamped),
    covers,
    targets,
  };
}

/** 把一关折成一局 */
export function levelMatch(level: SnowLevel): MatchSpec {
  return {
    mode: "campaign",
    windPlan: level.windPlan,
    covers: level.covers,
    targets: level.targets,
    throwers: [{ seat: 0, x: THROWER_X, dir: 1, balls: level.balls, walls: level.walls }],
    maxShots: level.balls + level.walls + 4,
  };
}

// ---------------------------------------------------------------------------
// 双人对战 / 人机对战
// ---------------------------------------------------------------------------

/** 对战场地:左右完全对称,谁都占不到便宜 */
export function duelMatch(ai: AiLevel | null): MatchSpec {
  const lanternsL: TargetSpec[] = [3, 7, 11].map((x) => ({ x, y: 2.4, r: 1.25, owner: 0 }));
  const lanternsR: TargetSpec[] = [49, 53, 57].map((x) => ({ x, y: 2.4, r: 1.25, owner: 1 }));
  const covers: CoverSpec[] = [
    { x: 20, w: 3, h: 6, hp: 3 },
    { x: 28.5, w: 3, h: 8, hp: 4 },
    { x: 37, w: 3, h: 6, hp: 3 },
  ];
  return {
    mode: ai ? "ai" : "versus",
    windPlan: [0.8, -1.4, 1.9, -0.6, 2.4, -2.1],
    covers,
    targets: [...lanternsL, ...lanternsR],
    throwers: [
      { seat: 0, x: 14, dir: 1, balls: -1, walls: 4 },
      { seat: 1, x: 46, dir: -1, balls: -1, walls: 4, ai },
    ],
    maxShots: 60,
  };
}

// ---------------------------------------------------------------------------
// 无尽:雪怪车轮战
// ---------------------------------------------------------------------------

export function endlessMatch(targets: TargetSpec[]): MatchSpec {
  return {
    mode: "endless",
    windPlan: [0, 1.2, -1.6, 2.2, -0.9, 1.7, -2.4],
    covers: [{ x: 18, w: 3, h: 5, hp: 3 }],
    targets,
    throwers: [{ seat: 0, x: THROWER_X, dir: 1, balls: -1, walls: 3 }],
    maxShots: 100000,
  };
}
