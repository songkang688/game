// 寻找外星朋友:188 关八大场景的关卡生成器(确定性,同一关每次布局完全一样)。
//
// 前面几章是纯找物:限定时间里把躲着外星小朋友的藏身点点出来;
// 从第 6 章起混进推理关:不给看,只给 3~5 条线索,靠排除法定位唯一的那个藏身点。
//
// 生成器只吐数据,不画一个像素;index.ts 负责把数据画成手绘感的场景,
// 单测负责验证「藏身点不重叠、目标点得到、推理题解唯一」。
import { TOTAL_LEVELS, chapterOf, indexInChapter, mulberry32, shuffled, type Chapter } from "../level99";
import {
  COLORS,
  KINDS,
  SCENE_H,
  SCENE_W,
  ZONES,
  clueHolds,
  endlessMissPenalty,
  endlessSeconds,
  endlessSpotCount,
  endlessTargetCount,
  isTop,
  solveDeduction,
  zoneOf,
  type Clue,
  type ColorName,
  type Spot,
  type SpotKind,
} from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "星星草坪", emoji: "🌱", color: "#dff5d8", desc: "第一次见面!东西不多,慢慢找就好", size: 24 },
  { name: "甜甜果园", emoji: "🍑", color: "#ffe3e8", desc: "果园里藏得多了一点,别漏掉线索物", size: 24 },
  { name: "咕噜溪谷", emoji: "💧", color: "#d9f0ff", desc: "溪水边的小家伙会轻轻晃,眼睛跟紧点", size: 24 },
  { name: "云朵小镇", emoji: "☁️", color: "#eaeeff", desc: "长得像的东西变多了,看清颜色再点", size: 24 },
  { name: "夜光森林", emoji: "🌙", color: "#e0dcf5", desc: "天黑了,躲起来的小朋友更难认", size: 23 },
  { name: "齿轮工坊", emoji: "⚙️", color: "#efe8dd", desc: "工坊里开始出推理题:按线索排除", size: 23 },
  { name: "水晶洞窟", emoji: "💎", color: "#dcf3f0", desc: "线索更多也更绕,一条一条划掉", size: 23 },
  { name: "银河灯塔", emoji: "🌌", color: "#e6e0f7", desc: "最后一站:找物和推理轮着来", size: 23 },
];

/** 外星小朋友的原创名字,过关提示里会点名夸奖 */
export const ALIEN_NAMES = ["糯糯", "云云", "墩墩", "闪闪", "绿绿豆", "啾啾"] as const;

/** 线索物:找物关里除了外星朋友还要顺手捡的小东西 */
export const CLUE_ITEMS = ["星星贴纸", "小铃铛", "彩色石子", "糖纸", "小钥匙"] as const;

/** 从第几章开始出现推理关(0 基) */
export const DEDUCE_FROM_CHAPTER = 5;

export interface FindTarget {
  /** 藏在第几个藏身点里 */
  spot: number;
  role: "alien" | "clue";
  /** 外星朋友的名字 / 线索物的名字 */
  name: string;
}

interface BaseLevel {
  /** 0 基关号;无尽轮与对战场用 -1 */
  index: number;
  chapter: number;
  spots: Spot[];
  /** 限时(秒) */
  seconds: number;
  hint: string;
  /**
   * 点错一次扣几秒。战役关不写这一项,按 `missPenalty(chapter)` 算;
   * 无尽轮的 chapter 是循环出来的,必须自带罚时才不会忽轻忽重。
   */
  penalty?: number;
}

export interface FindLevel extends BaseLevel {
  mode: "find";
  targets: FindTarget[];
}

export interface DeduceLevel extends BaseLevel {
  mode: "deduce";
  clues: Clue[];
  /** 唯一答案的藏身点下标 */
  answer: number;
  /** 躲在答案里的外星朋友叫什么 */
  alien: string;
}

export type SeekLevel = FindLevel | DeduceLevel;

// ---------------------------------------------------------------------------
// 藏身点布局
// ---------------------------------------------------------------------------

/** 场景四周留出来不放东西的边距 */
export const MARGIN = 90;
export const BIG_R = 62;
export const SMALL_R = 46;

/**
 * 按网格 + 抖动摆放藏身点,保证两两不重叠。
 *
 * 每个点只在自己的格子里抖动,而且抖动幅度永远留够半径,
 * 所以相邻两个圆的圆心距至少是「两个半径之和 + 8」,数学上就不可能叠在一起。
 * 「颜色 + 种类」的组合全场唯一——推理线索靠这句话指人,重复了就会指歪。
 */
export function layoutSpots(rand: () => number, count: number): Spot[] {
  const n = Math.max(4, Math.min(16, Math.round(count)));
  const cols = n <= 6 ? 3 : n <= 12 ? 4 : 5;
  const rows = Math.ceil(n / cols);
  const cellW = (SCENE_W - MARGIN * 2) / cols;
  const cellH = (SCENE_H - MARGIN * 2) / rows;
  // 格子小了就把藏身点一起画小,免得挤成一团
  const half = Math.min(cellW, cellH) / 2;
  const rBig = Math.max(26, Math.min(BIG_R, Math.round(half - 8)));
  const rSmall = Math.max(20, Math.min(SMALL_R, rBig - 14));

  const cells = shuffled(
    Array.from({ length: cols * rows }, (_, i) => i),
    rand
  ).slice(0, n);

  // 颜色 × 种类的全部组合先洗牌,再按顺序取,天然不重复
  const combos = shuffled(
    COLORS.flatMap((c) => KINDS.map((k) => ({ color: c as ColorName, kind: k as SpotKind }))),
    rand
  );

  const spots: Spot[] = [];
  cells.forEach((cell, i) => {
    const cx = cell % cols;
    const cy = Math.floor(cell / cols);
    const big = rand() < 0.45;
    const r = big ? rBig : rSmall;
    const jx = Math.max(0, cellW / 2 - r - 4) * (rand() * 2 - 1);
    const jy = Math.max(0, cellH / 2 - r - 4) * (rand() * 2 - 1);
    spots.push({
      x: Math.round(MARGIN + cellW * (cx + 0.5) + jx),
      y: Math.round(MARGIN + cellH * (cy + 0.5) + jy),
      r,
      big,
      color: combos[i].color,
      kind: combos[i].kind,
    });
  });
  return spots;
}

/** 有没有两个藏身点叠在一起(单测用) */
export function spotsOverlap(spots: Spot[]): boolean {
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      if (Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y) < spots[i].r + spots[j].r) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 推理题生成:必须保证解唯一
// ---------------------------------------------------------------------------

/** 对答案成立的「弱线索」候选池:一条一般只能划掉一部分,适合当前几条 */
function weakClues(spots: Spot[], answer: number): Clue[] {
  const a = spots[answer];
  const pool: Clue[] = [];
  for (const c of COLORS) if (c !== a.color) pool.push({ kind: "notColor", color: c });
  for (const k of KINDS) if (k !== a.kind) pool.push({ kind: "notKind", spot: k });
  for (const z of ZONES) if (z !== zoneOf(a.x)) pool.push({ kind: "notZone", zone: z });
  pool.push({ kind: "row", top: isTop(a.y) });
  pool.push({ kind: "size", big: a.big });
  return pool;
}

/** 对答案成立的「中等线索」:一条能划掉一大片 */
function mediumClues(spots: Spot[], answer: number): Clue[] {
  const a = spots[answer];
  const pool: Clue[] = [{ kind: "zone", zone: zoneOf(a.x) }];
  for (let i = 0; i < spots.length; i++) {
    if (i === answer) continue;
    if (a.x < spots[i].x) pool.push({ kind: "leftOf", ref: i });
    if (a.x > spots[i].x) pool.push({ kind: "rightOf", ref: i });
  }
  return pool;
}

/**
 * 对答案成立的「强线索」:颜色 + 种类两条加在一起一定能锁死唯一解,
 * 所以生成器永远收敛,不会出现「凑不出唯一答案」的死局。
 */
function strongClues(spots: Spot[], answer: number): Clue[] {
  const a = spots[answer];
  const pool: Clue[] = [];
  for (let i = 0; i < spots.length; i++) {
    if (i !== answer && clueHolds({ kind: "neighbor", ref: i }, spots, answer)) {
      pool.push({ kind: "neighbor", ref: i });
    }
  }
  pool.push({ kind: "isColor", color: a.color });
  pool.push({ kind: "isKind", spot: a.kind });
  return pool;
}

/** 推理题至少 / 最多几条线索 */
export const MIN_CLUES = 3;
export const MAX_CLUES = 5;

/** 按给定顺序贪心选线索,再把可有可无的那几条删掉;凑不出 3~5 条唯一解就返回 null */
function tryClues(spots: Spot[], answer: number, pool: Clue[]): Clue[] | null {
  const clues: Clue[] = [];
  for (const c of pool) {
    const alive = solveDeduction(spots, clues);
    if (alive.length === 1) break;
    if (clues.length >= MAX_CLUES) break;
    // 只要「能划掉至少一个候选」的线索,免得题面里塞废话
    const after = alive.filter((i) => clueHolds(c, spots, i)).length;
    if (after < alive.length) clues.push(c);
  }
  if (solveDeduction(spots, clues).length !== 1) return null;
  // 从后往前试着删:删掉之后仍然唯一,说明这条本来就是多余的
  for (let k = clues.length - 1; k >= 0; k--) {
    const trial = clues.filter((_, j) => j !== k);
    if (solveDeduction(spots, trial).length === 1) clues.splice(k, 1);
  }
  if (clues.length < MIN_CLUES || clues.length > MAX_CLUES) return null;
  return clues;
}

/**
 * 给定场景和答案,拼出一组「解唯一」的线索。
 *
 * 先只用弱线索和中线索多试几种顺序(这样题面全是排除法,最像六年级的推理题),
 * 都凑不出 3~5 条就把强线索(颜色 / 种类 / 挨着谁)也放进来。
 * 强线索里「是什么颜色」加「是什么东西」两条一定能锁死唯一解——
 * 生成器保证全场颜色 + 种类不重复,所以这个兜底永远成立,不会出现死局。
 */
export function buildClues(spots: Spot[], answer: number, rand: () => number): Clue[] {
  const weak = weakClues(spots, answer);
  const medium = mediumClues(spots, answer);
  const strong = strongClues(spots, answer);
  /** 一条线索单独看还留得下几个候选:留得越多这条越「弱」,题面才需要多凑几条 */
  const breadth = (c: Clue): number => solveDeduction(spots, [c]).length;

  // 先只用排除法式的弱线索,而且一开始不许用「一句话就点名」的强线索,
  // 这样精简完还能剩 3 条以上,才像一道要动脑筋的推理题。
  for (const minLeft of [4, 3, 2, 1]) {
    const w = weak.filter((c) => breadth(c) >= minLeft);
    const m = medium.filter((c) => breadth(c) >= minLeft);
    for (let attempt = 0; attempt < 6; attempt++) {
      const got = tryClues(spots, answer, [...shuffled(w, rand), ...shuffled(m, rand)]);
      if (got) return got;
    }
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const got = tryClues(spots, answer, [
      ...shuffled(weak, rand),
      ...shuffled(medium, rand),
      ...shuffled(strong, rand),
    ]);
    if (got) return got;
  }

  // 最后的兜底:颜色 + 种类必定唯一,不够 3 条就补几条同样成立的排除法(补的都是真话,唯一性不变)
  const a = spots[answer];
  const clues: Clue[] = [
    { kind: "isColor", color: a.color },
    { kind: "isKind", spot: a.kind },
  ];
  for (const c of shuffled(weak, rand)) {
    if (clues.length >= MIN_CLUES) break;
    clues.push(c);
  }
  return clues;
}

/** 这组线索是不是「一条都不能少」:少任何一条答案就不唯一了 */
export function cluesAreTight(spots: Spot[], clues: Clue[]): boolean {
  return clues.every((_, k) => solveDeduction(spots, clues.filter((__, j) => j !== k)).length > 1);
}

/**
 * 这一关的推理题该出几条线索。
 *
 * 刚开始出推理题的那一章给 3 条(入门:读三句话就能圈出答案),
 * 下一章 4 条,最后一章 5 条 —— 不这么点名的话生成器会一路吐 4~5 条,
 * 第 6 章开门第一道推理题就和最后一章一样绕,难度台阶少了一整档。
 */
export function clueBudgetFor(chapter: number): number {
  if (chapter <= DEDUCE_FROM_CHAPTER) return MIN_CLUES;
  if (chapter === DEDUCE_FROM_CHAPTER + 1) return MIN_CLUES + 1;
  return MAX_CLUES;
}

/** 一道推理题:答案 + 线索,只在 buildDeduction 内部流转 */
interface Riddle {
  answer: number;
  clues: Clue[];
}

/**
 * 给一张场景出一道推理题。
 *
 * 换着藏身点当答案试,优先挑出「3~5 条线索、一条都不能少、而且条数正好等于 want」的那种;
 * 凑不出正好的就取最接近的;万一整张场景连紧致题都凑不出,退而求其次也保证解唯一。
 */
export function buildDeduction(
  spots: Spot[],
  rand: () => number,
  want: number = MIN_CLUES + 1
): Riddle {
  const order = shuffled(
    spots.map((_, i) => i),
    rand
  );
  const goal = Math.max(MIN_CLUES, Math.min(MAX_CLUES, Math.round(want)));
  let best: { riddle: Riddle; gap: number } | null = null;
  let fallback: Riddle | null = null;

  for (const answer of order) {
    // buildClues 内部本来就会洗牌,同一个答案多问几次能拿到长短不同的题面
    for (let attempt = 0; attempt < 3; attempt++) {
      const clues = buildClues(spots, answer, rand);
      const sol = solveDeduction(spots, clues);
      if (sol.length !== 1 || sol[0] !== answer) continue;
      if (!fallback) fallback = { answer, clues };
      if (clues.length < MIN_CLUES || clues.length > MAX_CLUES) continue;
      if (!cluesAreTight(spots, clues)) continue;
      const gap = Math.abs(clues.length - goal);
      if (gap === 0) return { answer, clues };
      if (!best || gap < best.gap) best = { riddle: { answer, clues }, gap };
    }
  }
  return best?.riddle ?? fallback ?? { answer: order[0], clues: buildClues(spots, order[0], rand) };
}

// ---------------------------------------------------------------------------
// 逐关生成
// ---------------------------------------------------------------------------

interface GenOptions {
  chapter: number;
  spots: number;
  targets: number;
  seconds: number;
  deduce: boolean;
  /** 推理题想要几条线索(找物关用不上) */
  clueWant?: number;
  hint: string;
}

const FIND_HINTS = [
  "点一下藏着外星小朋友的地方,时间到就要重来啦。",
  "线索物也要捡:小铃铛、糖纸都算数。",
  "水边的小家伙会晃来晃去,看准了再点。",
  "长得像的东西变多了,先看颜色再看形状。",
  "天黑看不清就眯起眼睛,轮廓还是不一样的。",
];

const DEDUCE_HINTS = [
  "先把线索一条条读完,把不可能的地方一个个划掉。",
  "「不是……」这种线索最好用,先拿它砍掉一大片。",
  "位置线索要跟别的东西比着看,别急着下结论。",
  "剩下最后一个就是答案,点它!",
];

/** 这一关是不是推理关:第 6 章起隔一关来一道,第 8 章加密到隔一关一道 */
export function isDeduceLevel(level: number): boolean {
  const ci = chapterOf(CHAPTERS, level);
  if (ci < DEDUCE_FROM_CHAPTER) return false;
  const idx = indexInChapter(CHAPTERS, level);
  if (ci === DEDUCE_FROM_CHAPTER) return idx % 3 === 2;
  if (ci === DEDUCE_FROM_CHAPTER + 1) return idx % 2 === 1;
  return idx % 2 === 0;
}

function optionsFor(level: number): GenOptions {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const size = Math.max(1, CHAPTERS[ci].size - 1);
  const t = idx / size;
  const deduce = isDeduceLevel(level);
  return {
    chapter: ci,
    spots: Math.min(16, 6 + ci + Math.round(t * 3)),
    targets: deduce ? 1 : Math.min(5, 1 + Math.floor(ci / 2) + (t > 0.6 ? 1 : 0)),
    seconds: deduce
      ? Math.max(40, 70 - ci * 3)
      : Math.max(20, 46 - ci * 2 - Math.round(t * 6)),
    deduce,
    hint: deduce ? DEDUCE_HINTS[idx % DEDUCE_HINTS.length] : FIND_HINTS[ci % FIND_HINTS.length],
  };
}

function generate(opts: GenOptions, seed: number, index: number): SeekLevel {
  const rand = mulberry32(seed >>> 0);
  const spots = layoutSpots(rand, opts.spots);

  if (opts.deduce) {
    const { answer, clues } = buildDeduction(spots, rand, opts.clueWant ?? clueBudgetFor(opts.chapter));
    return {
      mode: "deduce",
      index,
      chapter: opts.chapter,
      spots,
      seconds: opts.seconds,
      hint: opts.hint,
      clues,
      answer,
      alien: ALIEN_NAMES[Math.abs(seed) % ALIEN_NAMES.length],
    };
  }

  const picks = shuffled(
    spots.map((_, i) => i),
    rand
  ).slice(0, Math.max(1, Math.min(opts.targets, spots.length - 1)));
  const targets: FindTarget[] = picks.map((spot, k) => ({
    spot,
    role: k === 0 ? "alien" : "clue",
    name: k === 0 ? ALIEN_NAMES[(Math.abs(seed) + k) % ALIEN_NAMES.length] : CLUE_ITEMS[k % CLUE_ITEMS.length],
  }));
  return {
    mode: "find",
    index,
    chapter: opts.chapter,
    spots,
    seconds: opts.seconds,
    hint: opts.hint,
    targets,
  };
}

/** 第 level 关(0 基) */
export function buildLevel(level: number): SeekLevel {
  const lv = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(level)));
  return generate(optionsFor(lv), 314159 + lv * 6971, lv);
}

export const LEVELS: SeekLevel[] = Array.from({ length: TOTAL_LEVELS }, (_, i) => buildLevel(i));

/** 全部推理关(单测拿它逐题断言解唯一) */
export const DEDUCE_LEVELS: DeduceLevel[] = LEVELS.filter((l): l is DeduceLevel => l.mode === "deduce");

/**
 * 无尽模式第 round 轮(1 基):点越来越多、时间越来越短,每第 4 轮来一道推理题。
 *
 * 三条曲线一律走 `logic.ts` 里那一份 —— 以前这里手抄了一遍同样的公式,
 * 改一处漏一处的风险白送,现在只有一个出处。
 */
export function buildEndlessRound(round: number): SeekLevel {
  const r = Math.max(1, Math.round(round));
  const deduce = r % 4 === 0;
  const opts: GenOptions = {
    chapter: (r - 1) % CHAPTERS.length,
    spots: endlessSpotCount(r),
    targets: deduce ? 1 : endlessTargetCount(r),
    seconds: deduce ? Math.max(30, 60 - r) : endlessSeconds(r),
    deduce,
    // 无尽的推理题跟着轮次加线索:头几轮 3 条入门,越往后越绕
    clueWant: Math.min(MAX_CLUES, MIN_CLUES + Math.floor(r / 12)),
    hint: deduce ? "推理时间!读完线索再点。" : "越来越多啦,眼睛要快!",
  };
  return { ...generate(opts, 880000 + r * 5171, -1), penalty: endlessMissPenalty(r) };
}

/** 双人对战第 round 局(1 基):同一张场景,两个人抢着点 */
export function buildVersusRound(round: number): FindLevel {
  const r = Math.max(1, Math.round(round));
  const opts: GenOptions = {
    chapter: (r - 1) % CHAPTERS.length,
    spots: Math.min(16, 10 + r),
    // 目标数取单数,不会出现「各找一半」的死平局
    targets: Math.min(9, 5 + (r % 2 === 0 ? 2 : 0)),
    seconds: 45,
    deduce: false,
    hint: "鸭梨用 W A S D 挪光标、F 确认;康康用方向键、L 确认。",
  };
  const lv = generate({ ...opts, targets: opts.targets }, 660000 + r * 3313, -1);
  return lv as FindLevel;
}
