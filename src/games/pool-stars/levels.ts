/**
 * 朵星台球 · 188 关关卡生成 + 残局解搜索。
 *
 * 关卡布局全部由关号（0 基）确定性生成：同一关每次进来摆得一模一样，
 * 所以「这一关有没有解」是可以在单测里搜出来的。
 *
 * 解的搜索分两层：
 *  1. `candidateShots`：几何候选角——每颗球对每个袋口的假想球点、
 *     加一次库边镜像的假想球点、加组合球的二段假想球点；
 *  2. `gridSolve`：纯粹的角度 × 力度网格全扫，兜底也当作单测的独立证据。
 */
import { assertTotal, mulberry32, type Chapter } from "../level99";
import {
  MAX_SHOT_SECONDS,
  POCKETS,
  TABLE,
  type Ball,
  type ShotResult,
  type Vec,
  angleTo,
  dist,
  ghostPoint,
  makeBall,
  mirrorPoint,
  pathClear,
  pocketed,
  simulateShot,
  spotFree,
  strike,
} from "./physics";
import { type Group, rackBalls } from "./rules";

export const CHAPTERS: Chapter[] = [
  { name: "直线入门", emoji: "🎯", color: "#d9f0e4", desc: "台面上只放一颗目标球，先把直线球打顺手。", size: 24 },
  { name: "库边反弹", emoji: "🪞", color: "#dfe9ff", desc: "母球必须先吃一次库，学会把角度折过去。", size: 24 },
  { name: "分组认识", emoji: "🌸", color: "#ffe6f0", desc: "只许先碰暖色组，冷色组是干扰，碰错就算犯规。", size: 24 },
  { name: "母球控制", emoji: "🎱", color: "#fff3d6", desc: "母球不许落袋，力度收着点，进球之后还要停得住。", size: 24 },
  { name: "组合球", emoji: "🔗", color: "#e8e0ff", desc: "打一碰二：先撞前面那颗，让它替你把后面那颗送进袋。", size: 22 },
  { name: "指定袋", emoji: "📮", color: "#ffe3d6", desc: "黑星球只认指定的那个袋，进别的袋不算数。", size: 22 },
  { name: "残局", emoji: "🧩", color: "#d6f2f6", desc: "台面三到五颗球，一杆一杆把自己那一组清干净。", size: 24 },
  { name: "球房杯", emoji: "🏆", color: "#f6e3ff", desc: "完整的一局八球，赢下这一局才算过关。", size: 24 },
];

/** 章节和恒等 188（`assertTotal` 在这里先自检一次，实现改坏了当场报错） */
export const TOTAL = 188;
assertTotal(CHAPTERS, TOTAL, "pool-stars");

export type LevelKind = "straight" | "bank" | "group" | "cueControl" | "combo" | "called" | "endgame" | "rack";

export interface LevelSpec {
  /** 0 基关号 */
  index: number;
  chapterIndex: number;
  kind: LevelKind;
  balls: Ball[];
  /** 这一关要打进的球 id（rack 关是空的：目标是赢下整局） */
  targetIds: number[];
  requireGroup: Group | null;
  requireCushionFirst: boolean;
  /** 组合球关：母球第一颗必须先碰这颗 */
  requireFirstHitId: number | null;
  cueMustSurvive: boolean;
  calledPocket: number | null;
  /** 允许几杆 */
  shots: number;
  /** 前期显示瞄准辅助线，后期关掉当难度 */
  showAim: boolean;
  /** rack 关的电脑档位 1..4 */
  aiTier: number;
  hint: string;
}

/** 关号属于第几章 */
export function chapterOfLevel(index: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (index < acc) return i;
  }
  return CHAPTERS.length - 1;
}

/** 六个袋口朝台面里的方向（弧度，y 向下） */
const POCKET_INWARD: readonly number[] = [
  Math.PI / 4,
  Math.PI / 2,
  (Math.PI * 3) / 4,
  -Math.PI / 4,
  -Math.PI / 2,
  (-Math.PI * 3) / 4,
];

function insideTable(p: Vec, margin = 1.4): boolean {
  return (
    p.x >= TABLE.r + margin &&
    p.x <= TABLE.w - TABLE.r - margin &&
    p.y >= TABLE.r + margin &&
    p.y <= TABLE.h - TABLE.r - margin
  );
}

function farFromPockets(p: Vec, mul = 1.8): boolean {
  return pocketed(p, POCKETS, TABLE.pocketR * mul) < 0;
}

function ray(from: Vec, ang: number, len: number): Vec {
  return { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len };
}

/** 在台面上找一个空位（确定性随机，找不到就返回 null） */
function freeSpot(rand: () => number, balls: readonly Ball[], avoid: { from: Vec; to: Vec }[] = []): Vec | null {
  for (let t = 0; t < 120; t++) {
    const p = {
      x: TABLE.r + 6 + rand() * (TABLE.w - 2 * TABLE.r - 12),
      y: TABLE.r + 6 + rand() * (TABLE.h - 2 * TABLE.r - 12),
    };
    if (!insideTable(p, 2)) continue;
    if (!farFromPockets(p)) continue;
    if (!spotFree(p, balls)) continue;
    let blocked = false;
    for (const seg of avoid) {
      if (!pathClear(seg.from, seg.to, [{ ...makeBall(-1, "warm", p.x, p.y) }])) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    return p;
  }
  return null;
}

interface StraightLine {
  pocket: number;
  target: Vec;
  cue: Vec;
}

/** 摆一条「母球 → 目标球 → 袋口」的直线，摆不下就换个袋口重试 */
function straightLine(rand: () => number, near: number, far: number): StraightLine {
  for (let t = 0; t < 60; t++) {
    const pocket = Math.floor(rand() * 6) % 6;
    const spread = pocket === 1 || pocket === 4 ? 0.3 : 0.42;
    const ang = POCKET_INWARD[pocket] + (rand() * 2 - 1) * spread;
    const d1 = near + rand() * 12;
    const d2 = far + rand() * 18;
    const target = ray(POCKETS[pocket], ang, d1);
    const cue = ray(POCKETS[pocket], ang, d1 + d2);
    if (!insideTable(target, 2) || !insideTable(cue, 2)) continue;
    if (!farFromPockets(cue)) continue;
    return { pocket, target, cue };
  }
  // 兜底：一条一定摆得下的中袋直线
  return { pocket: 1, target: { x: 100, y: 26 }, cue: { x: 100, y: 62 } };
}

function levelSeed(index: number): () => number {
  return mulberry32(index * 9176 + 4321);
}

// ---------------------------------------------------------------------------
// 按章生成
// ---------------------------------------------------------------------------

function buildStraight(index: number, ci: number, step: number): LevelSpec {
  const rand = levelSeed(index);
  const line = straightLine(rand, 20 + step * 6, 24 + step * 8);
  const balls = [
    makeBall(0, "cue", line.cue.x, line.cue.y),
    makeBall(1, "warm", line.target.x, line.target.y),
  ];
  return {
    index,
    chapterIndex: ci,
    kind: "straight",
    balls,
    targetIds: [1],
    requireGroup: null,
    requireCushionFirst: false,
    requireFirstHitId: null,
    cueMustSurvive: false,
    calledPocket: null,
    shots: step < 0.6 ? 3 : 2,
    showAim: true,
    aiTier: 1,
    hint: "把母球、目标球、袋口连成一条线，力度中等就够了。",
  };
}

function buildBank(index: number, ci: number, step: number): LevelSpec {
  const rand = levelSeed(index);
  for (let t = 0; t < 40; t++) {
    const line = straightLine(rand, 16 + step * 6, 18);
    const ghost = ghostPoint(line.target, POCKETS[line.pocket]);
    const side: "top" | "bottom" = ghost.y < TABLE.h / 2 ? "bottom" : "top";
    const mirror = mirrorPoint(ghost, side);
    // 母球放在台面另一侧，瞄镜像点必然先吃一次库
    const cue = {
      x: TABLE.r + 10 + rand() * (TABLE.w - 2 * TABLE.r - 20),
      y: side === "bottom" ? TABLE.h * (0.2 + rand() * 0.25) : TABLE.h * (0.55 + rand() * 0.25),
    };
    if (!insideTable(cue, 3) || !farFromPockets(cue)) continue;
    if (dist(cue, line.target) < TABLE.r * 6) continue;
    const cueBall = makeBall(0, "cue", cue.x, cue.y);
    const targetBall = makeBall(1, "warm", line.target.x, line.target.y);
    // 去镜像点的路上不能先撞到目标球，反弹之后到假想球点的路上也得干净
    const hitY = side === "bottom" ? TABLE.h - TABLE.r : TABLE.r;
    const k = (hitY - cue.y) / (mirror.y - cue.y);
    if (!(k > 0.05 && k < 1)) continue;
    const bouncePt = { x: cue.x + (mirror.x - cue.x) * k, y: hitY };
    if (!pathClear(cue, bouncePt, [targetBall])) continue;
    if (!pathClear(bouncePt, ghost, [targetBall], [1])) continue;
    return {
      index,
      chapterIndex: ci,
      kind: "bank",
      balls: [cueBall, targetBall],
      targetIds: [1],
      requireGroup: null,
      requireCushionFirst: true,
      requireFirstHitId: null,
      cueMustSurvive: false,
      calledPocket: null,
      shots: 3,
      showAim: true,
      aiTier: 1,
      hint: "先吃库再打球：把假想球点对着库边翻过去，瞄那个影子点。",
    };
  }
  const fallback = buildStraight(index, ci, step);
  return {
    ...fallback,
    kind: "bank",
    balls: [makeBall(0, "cue", 40, 50), makeBall(1, "warm", 150, 22)],
    targetIds: [1],
    requireCushionFirst: true,
    shots: 3,
    hint: "先吃库再打球：把假想球点对着库边翻过去，瞄那个影子点。",
  };
}

function buildGroup(index: number, ci: number, step: number): LevelSpec {
  const rand = levelSeed(index);
  const line = straightLine(rand, 20, 26 + step * 10);
  const balls = [
    makeBall(0, "cue", line.cue.x, line.cue.y),
    makeBall(1, "warm", line.target.x, line.target.y),
  ];
  const decoys = 1 + Math.round(step * 2);
  for (let i = 0; i < decoys; i++) {
    const p = freeSpot(rand, balls, [{ from: line.cue, to: POCKETS[line.pocket] }]);
    if (!p) break;
    balls.push(makeBall(balls.length, "cool", p.x, p.y));
  }
  return {
    index,
    chapterIndex: ci,
    kind: "group",
    balls,
    targetIds: [1],
    requireGroup: "warm",
    requireCushionFirst: false,
    requireFirstHitId: null,
    cueMustSurvive: false,
    calledPocket: null,
    shots: 3,
    showAim: step < 0.7,
    aiTier: 1,
    hint: "这一关只许先碰暖色组，冷色组碰到就算犯规。",
  };
}

function buildCueControl(index: number, ci: number, step: number): LevelSpec {
  const rand = levelSeed(index);
  const line = straightLine(rand, 16, 22 + step * 12);
  const balls = [
    makeBall(0, "cue", line.cue.x, line.cue.y),
    makeBall(1, "warm", line.target.x, line.target.y),
  ];
  const p = freeSpot(rand, balls, [{ from: line.cue, to: POCKETS[line.pocket] }]);
  if (p) balls.push(makeBall(2, "warm", p.x, p.y));
  return {
    index,
    chapterIndex: ci,
    kind: "cueControl",
    balls,
    targetIds: [1],
    requireGroup: null,
    requireCushionFirst: false,
    requireFirstHitId: null,
    cueMustSurvive: true,
    calledPocket: null,
    shots: 3,
    showAim: step < 0.5,
    aiTier: 1,
    hint: "母球掉袋这一关就算没过，力度收着点，进球之后让它停下来。",
  };
}

function buildCombo(index: number, ci: number, step: number): LevelSpec {
  const rand = levelSeed(index);
  for (let t = 0; t < 60; t++) {
    const pocket = Math.floor(rand() * 6) % 6;
    const spread = pocket === 1 || pocket === 4 ? 0.22 : 0.3;
    const ang = POCKET_INWARD[pocket] + (rand() * 2 - 1) * spread;
    const dB = 14 + rand() * 10;
    const dA = dB + TABLE.r * 2 + 2 + rand() * 8;
    const dCue = dA + 22 + rand() * 20 + step * 10;
    const bPos = ray(POCKETS[pocket], ang, dB);
    const aPos = ray(POCKETS[pocket], ang, dA);
    const cuePos = ray(POCKETS[pocket], ang, dCue);
    if (!insideTable(bPos, 2) || !insideTable(aPos, 2) || !insideTable(cuePos, 2)) continue;
    if (!farFromPockets(cuePos) || !farFromPockets(aPos)) continue;
    return {
      index,
      chapterIndex: ci,
      kind: "combo",
      balls: [
        makeBall(0, "cue", cuePos.x, cuePos.y),
        makeBall(1, "warm", bPos.x, bPos.y),
        makeBall(2, "warm", aPos.x, aPos.y),
      ],
      targetIds: [1],
      requireGroup: null,
      requireCushionFirst: false,
      requireFirstHitId: 2,
      cueMustSurvive: false,
      calledPocket: null,
      shots: 3,
      showAim: step < 0.5,
      aiTier: 1,
      hint: "母球只许先碰前面那颗，让它把后面那颗顶进袋。",
    };
  }
  return {
    index,
    chapterIndex: ci,
    kind: "combo",
    balls: [makeBall(0, "cue", 150, 50), makeBall(1, "warm", 112, 50), makeBall(2, "warm", 124, 50)],
    targetIds: [1],
    requireGroup: null,
    requireCushionFirst: false,
    requireFirstHitId: 2,
    cueMustSurvive: false,
    calledPocket: null,
    shots: 3,
    showAim: true,
    aiTier: 1,
    hint: "母球只许先碰前面那颗，让它把后面那颗顶进袋。",
  };
}

function buildCalled(index: number, ci: number, step: number): LevelSpec {
  const rand = levelSeed(index);
  const line = straightLine(rand, 18, 24 + step * 14);
  const balls = [
    makeBall(0, "cue", line.cue.x, line.cue.y),
    makeBall(1, "black", line.target.x, line.target.y),
  ];
  if (step > 0.4) {
    const p = freeSpot(rand, balls, [{ from: line.cue, to: POCKETS[line.pocket] }]);
    if (p) balls.push(makeBall(2, "cool", p.x, p.y));
  }
  return {
    index,
    chapterIndex: ci,
    kind: "called",
    balls,
    targetIds: [1],
    requireGroup: null,
    requireCushionFirst: false,
    requireFirstHitId: null,
    cueMustSurvive: true,
    calledPocket: line.pocket,
    shots: 2,
    showAim: step < 0.4,
    aiTier: 1,
    hint: "黑星球只认指定的那个袋，进别的袋不算数，母球也不能掉。",
  };
}

function buildEndgame(index: number, ci: number, step: number): LevelSpec {
  const rand = levelSeed(index);
  const line = straightLine(rand, 18, 24);
  const balls = [
    makeBall(0, "cue", line.cue.x, line.cue.y),
    makeBall(1, "warm", line.target.x, line.target.y),
  ];
  const extra = 2 + Math.round(step * 2); // 台面一共 3–5 颗球
  for (let i = 0; i < extra; i++) {
    const p = freeSpot(rand, balls, [{ from: line.cue, to: POCKETS[line.pocket] }]);
    if (!p) break;
    balls.push(makeBall(balls.length, i % 2 === 0 ? "warm" : "cool", p.x, p.y));
  }
  const targets = balls.filter((b) => b.kind === "warm").map((b) => b.id);
  return {
    index,
    chapterIndex: ci,
    kind: "endgame",
    balls,
    targetIds: targets,
    requireGroup: "warm",
    requireCushionFirst: false,
    requireFirstHitId: null,
    cueMustSurvive: true,
    calledPocket: null,
    shots: targets.length + 2,
    showAim: step < 0.35,
    aiTier: 1,
    hint: "先数一数自己那一组还剩几颗，挑最容易的那颗先打。",
  };
}

function buildRack(index: number, ci: number, step: number): LevelSpec {
  const tier = Math.min(4, 1 + Math.floor(step * 4));
  return {
    index,
    chapterIndex: ci,
    kind: "rack",
    balls: rackBalls((index % 31) + 1),
    targetIds: [],
    requireGroup: null,
    requireCushionFirst: false,
    requireFirstHitId: null,
    cueMustSurvive: false,
    calledPocket: null,
    shots: 99,
    showAim: step < 0.5,
    aiTier: tier,
    hint: "完整的一局：先清完自己那一组，再指定袋口把黑星球送进去。",
  };
}

const BUILDERS: Array<(index: number, ci: number, step: number) => LevelSpec> = [
  buildStraight,
  buildBank,
  buildGroup,
  buildCueControl,
  buildCombo,
  buildCalled,
  buildEndgame,
  buildRack,
];

/** 生成第 index 关（0 基）的完整布局 */
export function buildLevel(index: number): LevelSpec {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.round(index)));
  const ci = chapterOfLevel(lv);
  let start = 0;
  for (let i = 0; i < ci; i++) start += CHAPTERS[i].size;
  const step = CHAPTERS[ci].size <= 1 ? 0 : (lv - start) / (CHAPTERS[ci].size - 1);
  return BUILDERS[ci](lv, ci, step);
}

/** 无尽模式：一关比一关多一颗球的残局 */
export function buildEndlessLevel(round: number): LevelSpec {
  const n = Math.max(1, Math.round(round));
  const spec = buildEndgame(1000 + n, 6, Math.min(1, (n - 1) / 18));
  return {
    ...spec,
    index: n - 1,
    shots: Math.max(2, spec.targetIds.length + 1),
    showAim: n <= 3,
    hint: `第 ${n} 局残局：清完暖色组就能继续，母球掉袋就结束。`,
  };
}

// ---------------------------------------------------------------------------
// 成功判定与解搜索
// ---------------------------------------------------------------------------

export interface SuccessCheck {
  ok: boolean;
  reason: string;
}

/** 一杆打完之后，这一杆算不算达成了本关的要求（纯谓词，解搜索和真机同一套） */
export function levelSuccess(spec: LevelSpec, res: ShotResult): SuccessCheck {
  if (spec.cueMustSurvive && res.potted.some((p) => p.kind === "cue")) {
    return { ok: false, reason: "母球掉袋了，这一杆不算数，换个角度再来。" };
  }
  if (spec.requireCushionFirst && !res.cushionBeforeContact) {
    return { ok: false, reason: "这一关要先吃一次库，直接打过去不算数。" };
  }
  if (spec.requireFirstHitId !== null && res.firstHitId !== spec.requireFirstHitId) {
    return { ok: false, reason: "母球要先碰前面那颗球，才叫组合球。" };
  }
  if (spec.requireGroup !== null && res.firstHit !== spec.requireGroup) {
    return { ok: false, reason: "母球先碰到的不是自己那一组，这一杆差一点点。" };
  }
  const hit = res.potted.filter((p) => spec.targetIds.includes(p.id));
  if (hit.length === 0) return { ok: false, reason: "这一杆差一点点，换个角度再来。" };
  if (spec.calledPocket !== null) {
    const called = hit.find((p) => p.pocket === spec.calledPocket);
    if (!called) return { ok: false, reason: "进了，可惜不是指定的那个袋，再瞄一次。" };
  }
  return { ok: true, reason: "漂亮，这一杆完全对上了！" };
}

export interface Solution {
  angle: number;
  power: number;
}

/** 用某个角度力度打一杆，看看这一关成不成 */
export function tryShot(spec: LevelSpec, angle: number, power: number): { ok: boolean; res: ShotResult } {
  const balls = spec.balls.map((b) => ({ ...b }));
  const cueIdx = balls.findIndex((b) => b.kind === "cue");
  if (cueIdx < 0) return { ok: false, res: simulateShot({ balls }) };
  balls[cueIdx] = strike(balls[cueIdx], angle, power, 0);
  const res = simulateShot({ balls }, { maxSeconds: Math.min(MAX_SHOT_SECONDS, 14) });
  return { ok: levelSuccess(spec, res).ok, res };
}

/** 几何候选角：直球假想点 + 一次库边镜像点 + 组合球二段假想点 */
export function candidateShots(spec: LevelSpec): number[] {
  const cue = spec.balls.find((b) => b.kind === "cue");
  if (!cue) return [];
  const others = spec.balls.filter((b) => b.kind !== "cue" && !b.potted);
  const out: number[] = [];
  const push = (a: number): void => {
    if (Number.isFinite(a)) out.push(a);
  };
  for (const t of others) {
    for (const p of POCKETS) {
      const g = ghostPoint(t, p);
      push(angleTo(cue, g));
      for (const side of ["left", "right", "top", "bottom"] as const) {
        push(angleTo(cue, mirrorPoint(g, side)));
      }
    }
    // 组合球：先撞 a，让 a 去顶 t
    for (const a of others) {
      if (a.id === t.id) continue;
      for (const p of POCKETS) {
        const gT = ghostPoint(t, p);
        const gA = ghostPoint(a, gT);
        push(angleTo(cue, gA));
      }
    }
  }
  return out;
}

export const DEFAULT_POWERS: readonly number[] = [0.3, 0.45, 0.6, 0.8, 1];

/**
 * 纯网格扫描：角度按 angleSteps 均分一圈，力度按 powers 逐档试，
 * 找到第一个成功解就返回。单测拿它当「这一关真的有解」的独立证据。
 */
export function gridSolve(spec: LevelSpec, angleSteps = 240, powers: readonly number[] = DEFAULT_POWERS): Solution | null {
  for (let i = 0; i < angleSteps; i++) {
    const angle = (i / angleSteps) * Math.PI * 2;
    for (const power of powers) {
      if (tryShot(spec, angle, power).ok) return { angle, power };
    }
  }
  return null;
}

/**
 * 找一个能打成这一关的（角度、力度）：先试几何候选（含候选角附近 ±1.5° 的微调），
 * 再退回网格全扫。找不到返回 null。
 */
export function findSolution(
  spec: LevelSpec,
  opts: { powers?: readonly number[]; angleSteps?: number; gridFallback?: boolean } = {}
): Solution | null {
  const powers = opts.powers ?? DEFAULT_POWERS;
  const nudges = [0, 0.012, -0.012, 0.026, -0.026, 0.05, -0.05];
  for (const base of candidateShots(spec)) {
    for (const d of nudges) {
      const angle = base + d;
      for (const power of powers) {
        if (tryShot(spec, angle, power).ok) return { angle, power };
      }
    }
  }
  if (opts.gridFallback === false) return null;
  return gridSolve(spec, opts.angleSteps ?? 240, powers);
}

// ---------------------------------------------------------------------------
// 评星与文案
// ---------------------------------------------------------------------------

/** 用掉的杆数越少星越多 */
export function rateLevel(shotsUsed: number, allowed: number): 1 | 2 | 3 {
  if (shotsUsed <= Math.max(1, Math.ceil(allowed / 3))) return 3;
  if (shotsUsed <= Math.max(2, Math.ceil((allowed * 2) / 3))) return 2;
  return 1;
}

export function winLine(shotsUsed: number): string {
  if (shotsUsed <= 1) return "一杆到位，这条线你看得很准！";
  if (shotsUsed <= 3) return "节奏很稳，角度和力度都摸到门道了。";
  return "清干净啦！多试几次，杆数还能再省。";
}

/** 结算浮层上补的那句鼓励语；`reason` 自己已经把话说全了就不再重复 */
export const ENCOURAGE = "这一杆差一点点，换个角度再来。";

export function loseLine(reason: string): string {
  // 最常见的那条 reason 本身就是这句话，硬接一遍会连着说两遍
  if (reason.includes("这一杆差一点点")) return reason.endsWith("。") ? reason : `${reason}。`;
  return `${reason}${ENCOURAGE}`;
}
