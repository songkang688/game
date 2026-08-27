/**
 * 推箱小仓鼠 · 关卡数据层。
 *
 * 七章合计 188 关,越往后机关越多:
 *  ①木屑小屋 ②谷仓走廊 ③苹果地窖 ④冰湖溜溜 ⑤星星传送站 ⑥双鼠搭档 ⑦终极大仓库
 *
 * 每一关都是「生成 → 求解 → 通过才留下」出来的:generate.ts 用倒着拉的办法长出骨架,
 * solver.ts 再去把它解一遍。解不出来的候选一律换种子重来,所以**不存在推不完的关**;
 * levels.test.ts 会把 188 关逐关再验一次,并且把解法回放到规则层里确认真的赢了。
 *
 * 三星标准也是从求解器给的那条解算出来的:走得离最优解越近,星星越多。
 */
import { mulberry32, type Chapter } from "../level99";
import { buildSkeleton, decorate, freeCells } from "./generate";
import { isPlainRules, type Move, type Puzzle } from "./logic";
import { solutionFootprint, solve } from "./solver";

// ---------------------------------------------------------------------------
// 章节
// ---------------------------------------------------------------------------

export const CHAPTERS: Chapter[] = [
  {
    name: "木屑小屋",
    emoji: "🏠",
    color: "#FFF0D8",
    desc: "小仓鼠的家。箱子只能推、不能拉,把它推到脚印上就好啦。",
    size: 30,
  },
  {
    name: "谷仓走廊",
    emoji: "🌾",
    color: "#FBF3D2",
    desc: "谷仓的过道又长又窄,箱子多了起来,先想好推哪一个。",
    size: 28,
  },
  {
    name: "苹果地窖",
    emoji: "🍎",
    color: "#FBE0DE",
    desc: "地窖里拐来拐去。箱子推进死角就出不来了,推之前先看一眼后路。",
    size: 26,
  },
  {
    name: "冰湖溜溜",
    emoji: "❄️",
    color: "#DFF0FB",
    desc: "踩上冰面会一直滑!箱子滑到脚印上会「咔」地停住,这一点要好好利用。",
    size: 26,
  },
  {
    name: "星星传送站",
    emoji: "🌀",
    color: "#E7E1FA",
    desc: "两个漩涡是一对。走上去会被送到另一个,箱子被推上去也一样。",
    size: 26,
  },
  {
    name: "双鼠搭档",
    emoji: "🐹",
    color: "#E3F3DC",
    desc: "两只小仓鼠各守一间屋。按「换鼠」或者 Tab 键切换,两边都收拾好才算过关。",
    size: 26,
  },
  {
    name: "终极大仓库",
    emoji: "📦",
    color: "#EDE6DA",
    desc: "冰面、传送门、双搭档轮着上,前面学过的本事全都要用上!",
    size: 26,
  },
];

export const TOTAL = CHAPTERS.reduce((s, c) => s + c.size, 0);

export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

export function indexInChapterOf(level: number): number {
  const ci = chapterIndexOf(level);
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return level - acc;
}

// ---------------------------------------------------------------------------
// 每关的配方
// ---------------------------------------------------------------------------

export interface Recipe {
  w: number;
  h: number;
  /** 单间房里的箱子数(双鼠关是每间房各这么多) */
  boxesPerRoom: number;
  wallDensity: number;
  divided: boolean;
  iceRuns: number;
  portalPairs: number;
  feature: string;
  hint: string;
}

function lerpInt(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * Math.max(0, Math.min(1, t)));
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * Math.max(0, Math.min(1, t));
}

/** 终极大仓库里轮着上的五种搭配 */
const FINALE_VARIANTS: Array<Pick<Recipe, "divided" | "iceRuns" | "portalPairs" | "feature" | "hint">> = [
  {
    divided: false,
    iceRuns: 3,
    portalPairs: 0,
    feature: "大冰原",
    hint: "整片冰面!记住箱子滑到脚印上才会停,别让它滑过头。",
  },
  {
    divided: false,
    iceRuns: 0,
    portalPairs: 2,
    feature: "双漩涡",
    hint: "两对漩涡,推之前先想清楚箱子会被送到哪一个。",
  },
  {
    divided: true,
    iceRuns: 0,
    portalPairs: 0,
    feature: "双鼠仓库",
    hint: "两边同时开工。一边卡住了就先去帮另一边。",
  },
  {
    divided: true,
    iceRuns: 2,
    portalPairs: 0,
    feature: "双鼠溜冰",
    hint: "两只仓鼠各自的屋里都有冰面,慢慢来,别急着推。",
  },
  {
    divided: false,
    iceRuns: 2,
    portalPairs: 1,
    feature: "冰与漩涡",
    hint: "又滑又传!先在心里走一遍,再动手。",
  },
];

export function recipeFor(level: number): Recipe {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.round(level)));
  const ci = chapterIndexOf(lv);
  const pos = indexInChapterOf(lv);
  const t = CHAPTERS[ci].size > 1 ? pos / (CHAPTERS[ci].size - 1) : 0;

  switch (ci) {
    case 0:
      return {
        w: lerpInt(6, 7, t),
        h: lerpInt(6, 7, t),
        boxesPerRoom: lerpInt(1, 2, t),
        wallDensity: lerp(0.04, 0.14, t),
        divided: false,
        iceRuns: 0,
        portalPairs: 0,
        feature: "推箱入门",
        hint: "只能推不能拉。箱子贴到墙角就动不了啦,推之前先绕到后面看看。",
      };
    case 1:
      return {
        w: lerpInt(7, 8, t),
        h: 7,
        boxesPerRoom: lerpInt(2, 3, t),
        wallDensity: lerp(0.12, 0.22, t),
        divided: false,
        iceRuns: 0,
        portalPairs: 0,
        feature: "多箱调度",
        hint: "箱子多了先推离门口最远的那个,不然它会被别的箱子堵住。",
      };
    case 2:
      return {
        w: 8,
        h: lerpInt(7, 8, t),
        boxesPerRoom: lerpInt(3, 4, t),
        wallDensity: lerp(0.16, 0.26, t),
        divided: false,
        iceRuns: 0,
        portalPairs: 0,
        feature: "拐弯抹角",
        hint: "拐弯的时候要绕到箱子另一边去推,先数一数够不够地方站。",
      };
    case 3:
      return {
        w: lerpInt(7, 8, t),
        h: 7,
        boxesPerRoom: lerpInt(2, 3, t),
        wallDensity: lerp(0.18, 0.26, t),
        divided: false,
        iceRuns: lerpInt(2, 4, t),
        portalPairs: 0,
        feature: "冰面滑行",
        hint: "踩上冰会一路滑到底。箱子滑到脚印上会停下来,这是过关的关键。",
      };
    case 4:
      return {
        w: lerpInt(7, 8, t),
        h: 7,
        boxesPerRoom: lerpInt(2, 3, t),
        wallDensity: lerp(0.18, 0.26, t),
        divided: false,
        iceRuns: 0,
        portalPairs: lerpInt(1, 2, t),
        feature: "漩涡传送",
        hint: "漩涡两两成对。推箱子进漩涡之前,先自己走一趟看看会到哪儿。",
      };
    case 5:
      return {
        w: lerpInt(11, 13, t),
        h: lerpInt(7, 8, t),
        boxesPerRoom: lerpInt(1, 3, t),
        wallDensity: lerp(0.1, 0.2, t),
        divided: true,
        iceRuns: 0,
        portalPairs: 0,
        feature: "双鼠搭档",
        hint: "两只仓鼠一边一间。按「换鼠」或 Tab 换人,两边的箱子都归位才过关。",
      };
    default: {
      const v = FINALE_VARIANTS[pos % FINALE_VARIANTS.length];
      return {
        w: v.divided ? lerpInt(11, 13, t) : lerpInt(7, 8, t),
        h: v.divided ? lerpInt(7, 8, t) : 7,
        boxesPerRoom: v.divided ? lerpInt(1, 2, t) : lerpInt(2, 3, t),
        wallDensity: v.divided ? lerp(0.1, 0.18, t) : lerp(0.18, 0.26, t),
        iceRuns: v.iceRuns,
        portalPairs: v.portalPairs,
        divided: v.divided,
        feature: v.feature,
        hint: v.hint,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// 关卡
// ---------------------------------------------------------------------------

export type StageKind = "campaign" | "endless";

export interface LevelDef extends Puzzle {
  kind: StageKind;
  index: number;
  chapterIndex: number;
  name: string;
  feature: string;
  hint: string;
  /** 三星步数上限 */
  parMoves: number;
  /** 二星步数上限 */
  twoStarMoves: number;
  /** 求解器找到的那条解有多少步 */
  bestMoves: number;
  /** 那条解推了几次箱子 */
  bestPushes: number;
  /** 求解器给出的参考解(「卡住了看一步」用得上) */
  reference: Move[];
}

const SPOTS = [
  ["松果角", "小床边", "储粮罐", "木屑堆", "圆窗下", "小板凳", "橡果篮", "毛线球"],
  ["谷堆旁", "麦秆道", "风车下", "喂食槽", "梯子边", "长廊尽头", "麻袋阵", "谷仓门"],
  ["苹果架", "地窖梯", "腌菜坛", "拐角柜", "老木箱", "南瓜堆", "灯笼下", "地窖深处"],
  ["湖心亭", "薄冰区", "雪松边", "结霜坡", "冰裂缝", "溜冰道", "冰灯下", "冻鱼摊"],
  ["星轨台", "漩涡口", "接收站", "银河桥", "光斑区", "跳跃门", "中转仓", "星尘角"],
  ["左右屋", "双人梯", "对开门", "并排仓", "两小间", "分工区", "搭档台", "合作屋"],
  ["总控台", "顶层仓", "大转盘", "混合区", "终点线", "冠军台", "毕业礼", "满仓日"],
];

function levelName(ci: number, pos: number, rand: () => number): string {
  const list = SPOTS[ci % SPOTS.length];
  return `${CHAPTERS[ci].name}·${list[Math.floor(rand() * list.length)]}`;
}

/**
 * 这一关至少要推这么多下才算「像一关」。
 * 生成器会一直换种子重来,直到求解器给出的解够长为止 —— 不然随机拉出来的图
 * 会时不时冒出「一步推完」的白送关,尤其是冰面把箱子直接滑进脚印的时候。
 */
export function minPushesFor(recipe: Recipe): number {
  const boxes = recipe.boxesPerRoom * (recipe.divided ? 2 : 1);
  return Math.max(3, Math.round(boxes * 2.2));
}

interface Candidate {
  puzzle: Puzzle;
  moves: Move[];
  pushes: number;
  /** 机关撒上去了没有 */
  decorated: boolean;
}

/** 这一关这个配方要不要机关 */
function wantsDecor(recipe: Recipe): boolean {
  return recipe.iceRuns > 0 || recipe.portalPairs > 0;
}

/**
 * 候选打分:难度优先、机关其次。
 * 「够难」这一条值 600 分,压过任何机关 —— 宁可给一关没有冰面的硬题,
 * 也不给一关撒满冰面但一步就推完的白送题。
 */
function scoreCandidate(c: Candidate, floor: number, decorWanted: boolean): number {
  const difficulty = c.pushes >= floor ? 600 : c.pushes * 20;
  const mechanics = decorWanted && c.decorated ? 300 : 0;
  return difficulty + mechanics + Math.min(c.pushes, 30);
}

/** 满分候选的门槛:够难,而且该有的机关都有 */
function idealScore(decorWanted: boolean): number {
  return decorWanted ? 900 : 600;
}

/** 生成一次骨架 + 撒机关的完整尝试;骨架都没造出来就返回 null */
function attemptBuild(recipe: Recipe, seed: number): Candidate | null {
  const rand = mulberry32(seed);
  const floor = minPushesFor(recipe);
  const skeleton = buildSkeleton({
    w: recipe.w,
    h: recipe.h,
    wallDensity: recipe.wallDensity,
    divided: recipe.divided,
    boxesPerRoom: recipe.boxesPerRoom,
    rand,
    minDepth: Math.max(3, recipe.boxesPerRoom * 2),
  });
  if (!skeleton) return null;

  const base = solve(skeleton, { nodeCap: 140_000 });
  if (!base.solved) return null;
  const plain: Candidate = { puzzle: skeleton, moves: base.moves, pushes: base.pushes, decorated: false };

  const decorWanted = wantsDecor(recipe);
  if (!decorWanted) return plain;

  let best = plain;
  let bestScore = scoreCandidate(plain, floor, true);

  const consider = (c: Candidate): boolean => {
    const score = scoreCandidate(c, floor, true);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
    return score >= idealScore(true);
  };

  // 大胆档:随便撒,撒完重新求解,过了(而且没把关卡变白送)才用
  for (let bold = 0; bold < 4; bold++) {
    const cand = decorate(skeleton, {
      iceRuns: recipe.iceRuns,
      portalPairs: recipe.portalPairs,
      rand,
    });
    const res = solve(cand, { nodeCap: 50_000 });
    if (!res.solved) continue;
    if (consider({ puzzle: cand, moves: res.moves, pushes: res.pushes, decorated: true })) return best;
  }

  // 保底档:只撒在参考解一路没踩到的格子上,原来那条解一步不改照样走得通
  const footprint = solutionFootprint(skeleton, base.moves);
  const allowed = new Set(freeCells(skeleton).filter((c) => !footprint.has(c)));
  const safe = decorate(skeleton, {
    iceRuns: recipe.iceRuns,
    portalPairs: recipe.portalPairs,
    rand,
    allowed,
  });
  const safeRes = solve(safe, { nodeCap: 140_000 });
  if (safeRes.solved) {
    consider({ puzzle: safe, moves: safeRes.moves, pushes: safeRes.pushes, decorated: true });
  }
  return best;
}

/**
 * 兜底关:一间没有内墙的小空房推一个箱子。
 * 空房里回拉永远走得动,所以这一关一定造得出来、也一定推得完;
 * 真跑到这儿说明配方出了问题,levels.test.ts 里有断言盯着它别被用上。
 */
function fallbackPuzzle(): Candidate {
  for (const [w, h] of [[6, 5], [7, 5], [7, 6]] as const) {
    const skeleton = buildSkeleton({
      w,
      h,
      wallDensity: 0,
      divided: false,
      boxesPerRoom: 1,
      rand: mulberry32(0x1234 + w * 31 + h),
      minDepth: 1,
    });
    if (!skeleton) continue;
    const res = solve(skeleton, { nodeCap: 60_000 });
    if (res.solved) return { puzzle: skeleton, moves: res.moves, pushes: res.pushes, decorated: false };
  }
  throw new Error("推箱小仓鼠:兜底关也没造出来,这不应该发生");
}

const MAX_ATTEMPTS = 60;

function finalize(
  kind: StageKind,
  index: number,
  ci: number,
  recipe: Recipe,
  built: Candidate,
  nameRand: () => number
): LevelDef {
  const best = built.moves.length;
  return {
    ...built.puzzle,
    kind,
    index,
    chapterIndex: ci,
    name: kind === "campaign" ? levelName(ci, index, nameRand) : `第 ${index + 1} 仓 · ${CHAPTERS[ci].name}`,
    feature: recipe.feature,
    hint: recipe.hint,
    bestMoves: best,
    bestPushes: built.pushes,
    parMoves: Math.round(best * 1.25) + 4,
    twoStarMoves: Math.round(best * 2.1) + 10,
    reference: built.moves,
  };
}

/**
 * 一直换种子造,直到造出「够难 + 机关齐全」的那一关;
 * 攒够次数还没有满分候选,就把这一路上分最高的那张交出去。
 */
function bestOfAttempts(recipe: Recipe, seedBase: number): Candidate {
  const floor = minPushesFor(recipe);
  const decorWanted = wantsDecor(recipe);
  const ideal = idealScore(decorWanted);
  let best: Candidate | null = null;
  let bestScore = -1;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const built = attemptBuild(recipe, seedBase + attempt * 104729);
    if (!built) continue;
    const score = scoreCandidate(built, floor, decorWanted);
    if (score > bestScore) {
      bestScore = score;
      best = built;
    }
    if (score >= ideal) break;
  }
  return best ?? fallbackPuzzle();
}

/** 生成战役第 index 关(0 基)。同一个关号每次生成的结果完全一样 */
export function buildLevel(index: number): LevelDef {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.round(index)));
  const ci = chapterIndexOf(lv);
  const recipe = recipeFor(lv);
  const built = bestOfAttempts(recipe, 0x8f0000 + lv * 7919 + 17);
  return finalize("campaign", lv, ci, recipe, built, mulberry32(lv * 31 + 7));
}

const cache = new Map<number, LevelDef>();

/** 带缓存的取关(同一关反复重玩不用重算) */
export function getLevel(index: number): LevelDef {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.round(index)));
  const hit = cache.get(lv);
  if (hit) return hit;
  const made = buildLevel(lv);
  cache.set(lv, made);
  return made;
}

/** 无尽第一段爬坡爬到第几仓(0 基):仓库尺寸、箱子数、墙密度都在这里到顶 */
export const ENDLESS_RAMP_ROUNDS = 14;
/** 第二段每几仓再加一档机关 */
export const ENDLESS_LATE_STEP = 4;
/** 无尽仓的机关上限(和战役章节里已经验证过的上限一样) */
export const ENDLESS_MAX_ICE = 4;
export const ENDLESS_MAX_PORTALS = 2;

/** 第二段爬了几档(第 15 仓起才开始算) */
function endlessLateStep(round: number): number {
  return Math.max(0, Math.floor((Math.max(0, round) - ENDLESS_RAMP_ROUNDS) / ENDLESS_LATE_STEP));
}

/** 第 round 仓有几段冰面 */
export function endlessIceRuns(round: number): number {
  const r = Math.max(0, Math.round(round));
  if (r < 6) return 0;
  return Math.min(ENDLESS_MAX_ICE, 2 + Math.floor(endlessLateStep(r) / 2));
}

/** 第 round 仓有几对漩涡 */
export function endlessPortalPairs(round: number): number {
  const r = Math.max(0, Math.round(round));
  if (r < 10) return 0;
  return Math.min(ENDLESS_MAX_PORTALS, 1 + Math.floor(endlessLateStep(r) / 3));
}

/**
 * 无尽第 round 仓的难度分:尺寸、箱子、墙、冰、漩涡合成一个数,
 * 和另外四款的 `endlessDifficulty` 一个口径,单测拿它钉住「曲线一路不掉头」。
 * 第 31 仓五条曲线全部到顶,再往后是同一个分数。
 */
export function endlessDifficulty(round: number): number {
  const r = Math.max(0, Math.round(round));
  const ramp = Math.min(1, r / ENDLESS_RAMP_ROUNDS);
  return (
    lerpInt(7, 8, ramp) * 2 +
    lerpInt(1, 3, ramp) * 20 +
    Math.round(lerp(0.12, 0.26, ramp) * 100) +
    endlessIceRuns(r) * 6 +
    endlessPortalPairs(r) * 10
  );
}

/** 难度分到顶的那一仓(0 基);再往后只换名字和布局 */
export const ENDLESS_PEAK_ROUND = 30;

/**
 * 无尽模式「仓库大挑战」的第 round 仓(0 基)。
 * 一仓比一仓大、箱子一仓比一仓多,机关也逐步加进来。
 *
 * 前 14 仓把尺寸、箱子数、墙密度一次爬满;第 15 仓起换成慢档,
 * 每 4 仓多一段冰或多一对漩涡——这两样在战役里已经验证过能到 4 段 / 2 对,
 * 是这套生成器手上还没用完的余量。墙密度不再往上加:0.26 以上没验证过,
 * 密到一定程度求解器会一路退回兜底关,反而更简单。
 */
export function buildEndless(round: number): LevelDef {
  const r = Math.max(0, Math.round(round));
  const ci = Math.min(CHAPTERS.length - 1, Math.floor(r / 3));
  const ramp = Math.min(1, r / ENDLESS_RAMP_ROUNDS);
  const recipe: Recipe = {
    w: lerpInt(7, 8, ramp),
    h: 7,
    boxesPerRoom: lerpInt(1, 3, ramp),
    wallDensity: lerp(0.12, 0.26, ramp),
    divided: false,
    iceRuns: endlessIceRuns(r),
    portalPairs: endlessPortalPairs(r),
    feature: "仓库大挑战",
    hint: "一仓接一仓,推完就换下一仓!步数用完这趟就结束。",
  };
  return finalize("endless", r, ci, recipe, bestOfAttempts(recipe, 0x5ee000 + r * 26417 + 5), mulberry32(r * 13 + 3));
}

// ---------------------------------------------------------------------------
// 评分
// ---------------------------------------------------------------------------

/** 按用了多少步评星 */
export function starsForMoves(def: Pick<LevelDef, "parMoves" | "twoStarMoves">, moves: number): 1 | 2 | 3 {
  if (moves <= def.parMoves) return 3;
  if (moves <= def.twoStarMoves) return 2;
  return 1;
}

export function winMessage(def: LevelDef, moves: number, undos: number): string {
  const stars = starsForMoves(def, moves);
  if (stars === 3) {
    return `${moves} 步搞定,和小仓鼠算出来的 ${def.bestMoves} 步几乎一样快,太厉害啦!`;
  }
  if (stars === 2) {
    return `${moves} 步推完!再省下 ${Math.max(1, moves - def.parMoves)} 步就是三颗星啦。`;
  }
  const tail = undos > 0 ? "撤销键随便用,想清楚再推就更省步数。" : "先在心里走一遍再动手,能省下不少步。";
  return `${moves} 步推完,箱子全部归位!${tail}`;
}

/** 这一关都用到了哪些机关(给关卡头部的小标签) */
export function featureTags(def: LevelDef): string[] {
  const tags: string[] = [];
  if (def.hamsters.length > 1) tags.push("🐹🐹 双搭档");
  if (def.ice.some(Boolean)) tags.push("❄️ 冰面");
  if (def.portal.some((p) => p >= 0)) tags.push("🌀 传送门");
  if (tags.length === 0 && isPlainRules(def)) tags.push("📦 纯推箱");
  return tags;
}
