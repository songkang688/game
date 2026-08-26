// 小怪物危机 —— 188 关战役的章节与波次数据(纯数据 + 纯函数,不碰 DOM)。
//
// 每一关的波次都由确定性随机数生成:同一关无论玩多少次、在谁的机器上跑,
// 出怪表都一模一样,无头模拟器才能拿它做「可守住性」回归测试。

import type { Chapter } from "../level99";
import {
  BUILD_COLS,
  CHAPTER_BOSSES,
  LANES,
  MONSTER_THREAT,
  type MonsterKind,
  type Spawn,
  type TowerKind,
  TOWER_KINDS,
  TOWER_UNLOCK_CHAPTER,
  type WaveDef,
  mulberry32,
  randInt,
} from "./logic";

/** 八个主题章节,关卡数之和恒等于 188。 */
export const CHAPTERS: Chapter[] = [
  {
    name: "自家小院",
    emoji: "🏡",
    color: "#ffe3ef",
    desc: "第一次守家:摇杆走位、按住技能钮甩颜料弹,把小怪物涂成小云朵。",
    size: 24,
  },
  {
    name: "彩虹街区",
    emoji: "🏘️",
    color: "#ffe9d2",
    desc: "陀螺怪画着圈绕过来,别追屁股,站在它要去的地方等。",
    size: 24,
  },
  {
    name: "叮咚学校",
    emoji: "🏫",
    color: "#e6f3d8",
    desc: "南瓜灯怪正面顶着一块盾,绕到它侧后方再甩才涂得上。",
    size: 24,
  },
  {
    name: "咕噜游乐园",
    emoji: "🎠",
    color: "#dcefff",
    desc: "气球怪站得远远地吐泡泡,先横着躲开再贴上去糊它。",
    size: 24,
  },
  {
    name: "月光工厂",
    emoji: "🌙",
    color: "#e2ddf7",
    desc: "纸箱怪的壳最厚,先攒够成长卡再硬碰硬。",
    size: 24,
  },
  {
    name: "云朵糖果城",
    emoji: "🍬",
    color: "#ffe0f6",
    desc: "果冻怪会变出小跟班,先把大的糊掉小的就不出来了。",
    size: 23,
  },
  {
    name: "星星电影院",
    emoji: "🎬",
    color: "#d9ecec",
    desc: "跳跳怪窜得又快又飘,提前一步堵在家和它中间。",
    size: 23,
  },
  {
    name: "彩虹总部",
    emoji: "🌈",
    color: "#f0e4ff",
    desc: "全员出动的大混战:多向 + 攻速一起叠,绕着家跑起来。",
    size: 22,
  },
];

/** 战役总关数(与 level99 框架的 TOTAL_LEVELS 一致)。 */
export const TOTAL = CHAPTERS.reduce((s, c) => s + c.size, 0);

/** 每章第一关的关号(0 基)。 */
export const CHAPTER_STARTS: number[] = (() => {
  const out: number[] = [];
  let acc = 0;
  for (const c of CHAPTERS) {
    out.push(acc);
    acc += c.size;
  }
  return out;
})();

export function chapterOfLevel(levelIdx: number): number {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) {
    if (levelIdx >= CHAPTER_STARTS[i]) return i;
  }
  return 0;
}

export function indexInChapter(levelIdx: number): number {
  return levelIdx - CHAPTER_STARTS[chapterOfLevel(levelIdx)];
}

/** 这一关是不是章节最后一关(也就是大怪关)。 */
export function isBossLevel(levelIdx: number): boolean {
  const ci = chapterOfLevel(levelIdx);
  return indexInChapter(levelIdx) === CHAPTERS[ci].size - 1;
}

/* ------------------------------------------------------------------ */
/* 出场阵容                                                            */
/* ------------------------------------------------------------------ */

/** 每章新加入的小怪物(前面章节的会一直留在名单里)。 */
const CHAPTER_NEW_MONSTER: Array<MonsterKind[]> = [
  ["doodle", "cotton"],
  ["spinner"],
  ["pumpkin"],
  ["balloon"],
  ["box"],
  ["jelly"],
  ["hopper"],
  [],
];

export function rosterAtChapter(chapter: number): MonsterKind[] {
  const out: MonsterKind[] = [];
  for (let i = 0; i <= Math.min(chapter, CHAPTER_NEW_MONSTER.length - 1); i++) {
    for (const k of CHAPTER_NEW_MONSTER[i]) if (!out.includes(k)) out.push(k);
  }
  return out;
}

/** 章节首关会解锁一件新建筑;没有新建筑就返回 undefined。 */
export function unlockAtLevel(levelIdx: number): TowerKind | undefined {
  const ci = chapterOfLevel(levelIdx);
  if (indexInChapter(levelIdx) !== 0) return undefined;
  return TOWER_KINDS.find((k) => TOWER_UNLOCK_CHAPTER[k] === ci && ci > 0);
}

/* ------------------------------------------------------------------ */
/* 难度预算                                                            */
/* ------------------------------------------------------------------ */

/**
 * 一关能派出多少「难缠分」。章节之间跳一大步(新怪新机制),
 * 章节内部一关一关小步爬,最后一关的大怪另算。
 */
export function levelBudget(levelIdx: number): number {
  const ci = chapterOfLevel(levelIdx);
  const k = indexInChapter(levelIdx);
  const raw = 16 + ci * 22 + k * 1.6;
  return Math.round(isBossLevel(levelIdx) ? raw * 0.55 : raw);
}

/** 一关分几波。 */
export function waveCount(levelIdx: number): number {
  return 2 + Math.min(3, Math.floor(chapterOfLevel(levelIdx) / 2));
}

/* ------------------------------------------------------------------ */
/* 关卡定义                                                            */
/* ------------------------------------------------------------------ */

export interface BlockedCell {
  col: number;
  lane: number;
}

export interface LevelDef {
  chapter: number;
  /** 家里有几罐颜料:被抢光就要重来 */
  homeHp: number;
  /** 开局手里的颜料 */
  startPaint: number;
  /** 花坛、水洼这类摆不了东西的格子 */
  blocked: BlockedCell[];
  /** 章节大怪(只有章节最后一关有) */
  boss: MonsterKind | null;
  /** 本关新解锁的建筑 */
  unlock?: TowerKind;
  waves: WaveDef[];
}

export const HOME_HP = 3;

/** 障碍格只落在右半区(第 5–7 列),左边的核心建造区永远是干净的。 */
function buildBlocked(rand: () => number, chapter: number): BlockedCell[] {
  const want = Math.min(4, Math.max(0, chapter - 1));
  const out: BlockedCell[] = [];
  const perLane = new Array<number>(LANES).fill(0);
  let guard = 0;
  while (out.length < want && guard++ < 40) {
    const col = randInt(rand, 5, BUILD_COLS - 1);
    const lane = randInt(rand, 0, LANES - 1);
    if (perLane[lane] >= 2) continue;
    if (out.some((c) => c.col === col && c.lane === lane)) continue;
    perLane[lane]++;
    out.push({ col, lane });
  }
  return out.sort((a, b) => a.lane - b.lane || a.col - b.col);
}

/** 按预算挑一只小怪物;剩下的预算不够任何一只就返回 null。 */
function pickMonster(rand: () => number, roster: readonly MonsterKind[], remaining: number): MonsterKind | null {
  const affordable = roster.filter((k) => MONSTER_THREAT[k] <= remaining);
  if (affordable.length === 0) return null;
  return affordable[Math.floor(rand() * affordable.length)];
}

/** 把一波的预算摊成一串出场安排:车道轮转 + 随机错开,不会全挤在一条道。 */
function buildWave(
  rand: () => number,
  roster: readonly MonsterKind[],
  budget: number,
  minCount: number,
  boss: MonsterKind | null
): WaveDef {
  const kinds: MonsterKind[] = [];
  let left = budget;
  let guard = 0;
  while (left > 0 && guard++ < 200) {
    const k = pickMonster(rand, roster, left);
    if (!k) break;
    kinds.push(k);
    left -= MONSTER_THREAT[k];
  }
  while (kinds.length < minCount) kinds.push("doodle");

  const span = 5 + kinds.length * 1.3;
  let lane = randInt(rand, 0, LANES - 1);
  const spawns: Spawn[] = kinds.map((kind, i) => {
    lane = (lane + 1 + randInt(rand, 0, LANES - 2)) % LANES;
    const t = kinds.length === 1 ? 0.6 : 0.6 + (span * i) / (kinds.length - 1 || 1);
    return { time: Math.round(t * 10) / 10, lane, kind };
  });

  if (boss) {
    spawns.push({ time: Math.round((span * 0.35 + 0.6) * 10) / 10, lane: Math.floor(LANES / 2), kind: boss });
  }
  spawns.sort((a, b) => a.time - b.time);
  return { spawns, tail: 3 };
}

function buildLevel(levelIdx: number): LevelDef {
  const ci = chapterOfLevel(levelIdx);
  const rand = mulberry32(levelIdx * 7919 + 1013);
  const roster = rosterAtChapter(ci);
  const total = levelBudget(levelIdx);
  const count = waveCount(levelIdx);
  const boss = isBossLevel(levelIdx) ? CHAPTER_BOSSES[ci] : null;

  // 后面的波比前面的重:权重 1,2,3…,总和刚好还是这一关的预算
  const weights: number[] = [];
  for (let i = 0; i < count; i++) weights.push(i + 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const waves: WaveDef[] = [];
  for (let i = 0; i < count; i++) {
    const share = Math.max(6, Math.round((total * weights[i]) / weightSum));
    waves.push(buildWave(rand, roster, share, i === 0 ? 2 : 3, i === count - 1 ? boss : null));
  }

  return {
    chapter: ci,
    homeHp: HOME_HP,
    startPaint: 6 + ci,
    blocked: buildBlocked(rand, ci),
    boss,
    unlock: unlockAtLevel(levelIdx),
    waves,
  };
}

/** 188 关全量数据(模块加载时一次生成,后面只读)。 */
export const LEVELS: LevelDef[] = Array.from({ length: TOTAL }, (_, i) => buildLevel(i));

/** 一关一共派出多少只小怪物(含大怪)。 */
export function levelMonsterCount(levelIdx: number): number {
  return LEVELS[levelIdx].waves.reduce((s, w) => s + w.spawns.length, 0);
}

/* ------------------------------------------------------------------ */
/* 无尽 / 双人合作 / 非对称对战                                          */
/* ------------------------------------------------------------------ */

/** 无尽模式第 n 波(1 基)的出怪名单。 */
export function endlessRoster(wave: number): MonsterKind[] {
  const out: MonsterKind[] = ["doodle", "cotton"];
  if (wave >= 3) out.push("spinner");
  if (wave >= 5) out.push("pumpkin");
  if (wave >= 7) out.push("balloon");
  if (wave >= 9) out.push("box");
  if (wave >= 11) out.push("jelly");
  if (wave >= 13) out.push("hopper");
  return out;
}

/** 无尽模式每 8 波来一只大怪。 */
export function endlessBoss(wave: number): MonsterKind | null {
  if (wave <= 0 || wave % 8 !== 0) return null;
  return CHAPTER_BOSSES[Math.min(CHAPTER_BOSSES.length - 1, Math.floor(wave / 8) - 1)];
}

export function endlessBudget(wave: number): number {
  return Math.round(14 + Math.max(0, wave - 1) * 9);
}

export function buildEndlessWave(wave: number): WaveDef {
  const rand = mulberry32(wave * 2654435761 + 77);
  return buildWave(rand, endlessRoster(wave), endlessBudget(wave), 3, endlessBoss(wave));
}

/** 双人合作:目标是一起挡满这么多波。 */
export const COOP_TARGET_WAVES = 10;

export function buildCoopWave(wave: number): WaveDef {
  const rand = mulberry32(wave * 40503 + 991);
  const budget = Math.round(endlessBudget(wave) * 1.35);
  return buildWave(rand, endlessRoster(wave), budget, 4, endlessBoss(wave));
}

/** 非对称对战:守家方要撑满这么多秒。 */
export const VERSUS_SECONDS = 100;

/** 无尽 / 合作 / 对战里小怪物血量按「等效关号」变厚,曲线和战役对齐。 */
export function endlessLevelIndex(wave: number): number {
  return Math.min(TOTAL - 1, Math.max(0, (wave - 1) * 8));
}
