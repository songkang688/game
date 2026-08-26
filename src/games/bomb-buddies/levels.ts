// 泡泡炸弹人 · 188 关关卡生成器(确定性:同一关每次布局完全一样)。
//
// 八个章节合计 188 关,章节和由 level99 的 assertTotal 兜底校验。
// 每一关给出:棋盘尺寸、硬墙格局、软砖分布、小怪配置、目标(清怪 / 找出口 / 泡泡王)、
// 限时、初始道具与藏在砖里的道具。
//
// 生成器只吐数据,不画一个像素,也不碰 DOM,所以关卡合法性可以在单测里全量扫一遍:
// 「每一关都能从出生点走到全部小怪与出口」是硬指标,不允许出现死图。

import { TOTAL_LEVELS, mulberry32, randInt, shuffled, type Chapter } from "../level99";
import {
  DIR_DOWN,
  TILE_FLOOR,
  TILE_HARD,
  TILE_SOFT,
  canStand,
  idx,
  makeBoard,
  makeCritter,
  neighbors,
  rollItem,
  type Board,
  type Critter,
  type CritterKind,
  type GoalKind,
  type ItemKind,
} from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "泡泡草坪", emoji: "🫧", color: "#dff3e4", desc: "先熟悉放弹与躲弹:炸开软砖,把咕噜怪包成泡泡", size: 24 },
  { name: "糖果工坊", emoji: "🍬", color: "#ffe6ef", desc: "道具开始变多,火力和炸弹数攒起来清场更快", size: 24 },
  { name: "清凉水乡", emoji: "💧", color: "#dceffb", desc: "蹦蹦怪转弯很快,学会用拐角挡住爆风", size: 24 },
  { name: "云朵集市", emoji: "☁️", color: "#eceefb", desc: "第一次出现出口关:炸开砖找到出口再走过去", size: 24 },
  { name: "齿轮矿洞", emoji: "⚙️", color: "#f0e9dd", desc: "追追怪会一路跟着你,踢炸弹在这里很好用", size: 23 },
  { name: "星光冰原", emoji: "❄️", color: "#e3f1f7", desc: "钻墙怪能穿软砖,提前想好两条退路", size: 23 },
  { name: "彩虹沙漠", emoji: "🌈", color: "#fdeedd", desc: "地图更大、限时更紧,连锁引爆能省下不少时间", size: 23 },
  { name: "月亮城堡", emoji: "🌙", color: "#e8e2f7", desc: "泡泡王登场:要连着包三层泡泡才请得动它回家", size: 23 },
];

/** 一关的全部数据 */
export interface BombLevel {
  /** 0 基关号;无尽轮与对战场用 -1 */
  index: number;
  chapter: number;
  board: Board;
  /** 两位玩家的出生格(单人只用第一个) */
  spawns: number[];
  critters: Critter[];
  /** 藏在软砖底下的道具 */
  hidden: Map<number, ItemKind>;
  goal: GoalKind;
  /** 出口格(-1 表示这一关不用找出口) */
  exit: number;
  /** 限时(秒) */
  seconds: number;
  /** 出生时就带的道具(一开始就给一点甜头) */
  starters: ItemKind[];
  /** 爆风能不能贯通软砖 */
  pierce: boolean;
  /** 道具掉落丰度 */
  richness: number;
  seed: number;
  hint: string;
}

// ---------------------------------------------------------------------------
// 棋盘骨架
// ---------------------------------------------------------------------------

/** 尺寸一律取奇数:奇数行列摆硬墙才是标准的迷宫格局 */
export function oddSize(n: number): number {
  const v = Math.max(7, Math.round(n));
  return v % 2 === 1 ? v : v + 1;
}

/**
 * 铺一张空棋盘:外圈一整圈硬墙,内部横纵都是偶数的位置摆硬墙柱子,其余是空地。
 *
 * 尺寸取奇数以后,外圈(x=0 / x=w-1)正好也落在偶数上,柱子和围墙连成同一套格局;
 * 四个角 (1,1) 这类奇数坐标一定是空地,所以出生点永远不会被墙压住,
 * 而且任何一条走廊都至少一格宽,绕行的路永远存在。
 */
export function pillarBoard(w: number, h: number): Board {
  const board = makeBoard(oddSize(w), oddSize(h), TILE_FLOOR);
  for (let y = 0; y < board.h; y++) {
    for (let x = 0; x < board.w; x++) {
      const edge = x === 0 || y === 0 || x === board.w - 1 || y === board.h - 1;
      const pillar = x % 2 === 0 && y % 2 === 0;
      if (edge || pillar) board.cells[idx(board, x, y)] = TILE_HARD;
    }
  }
  return board;
}

/** 出生点周围要留出来的空地(不放砖也不放怪),免得一开局就被堵死 */
export function spawnClear(board: Board, spawn: number): number[] {
  const out = [spawn, ...neighbors(board, spawn)];
  return out.filter((c) => board.cells[c] !== TILE_HARD);
}

/** 四个角的出生格(左上、右下、右上、左下) */
export function cornerSpawns(board: Board): number[] {
  return [
    idx(board, 1, 1),
    idx(board, board.w - 2, board.h - 2),
    idx(board, board.w - 2, 1),
    idx(board, 1, board.h - 2),
  ];
}

/**
 * 往空地上撒软砖。
 * `keep` 里的格子永远保持空着(出生点与它的邻格、小怪的落脚点)。
 */
export function scatterBricks(board: Board, rand: () => number, density: number, keep: ReadonlySet<number>): number[] {
  const placed: number[] = [];
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] !== TILE_FLOOR || keep.has(i)) continue;
    if (rand() < density) {
      board.cells[i] = TILE_SOFT;
      placed.push(i);
    }
  }
  return placed;
}

/** 从某一格出发能走到的全部格子(软砖当墙,用来验证关卡不是死图) */
export function reachable(board: Board, from: number, throughBricks = false): Set<number> {
  const seen = new Set<number>([from]);
  const queue = [from];
  while (queue.length > 0) {
    const cell = queue.shift() as number;
    for (const nb of neighbors(board, cell)) {
      if (seen.has(nb)) continue;
      if (!canStand(board, nb, { ghost: throughBricks })) continue;
      seen.add(nb);
      queue.push(nb);
    }
  }
  return seen;
}

// ---------------------------------------------------------------------------
// 每一章的配方
// ---------------------------------------------------------------------------

interface Recipe {
  w: number;
  h: number;
  density: number;
  critters: CritterKind[];
  goal: GoalKind;
  seconds: number;
  starters: ItemKind[];
  pierce: boolean;
  richness: number;
}

/** 章节 + 章内序号 → 这一关的配方(纯函数,便于单测逐关体检) */
export function recipeFor(chapter: number, within: number, size: number): Recipe {
  // 章内进度 0..1:同一章里越往后,场地越大、砖越密、小怪越多
  const t = size > 1 ? within / (size - 1) : 0;
  const w = oddSize(9 + Math.round(chapter * 0.75) + (t > 0.6 ? 2 : 0));
  const h = oddSize(9 + Math.round(chapter * 0.5) + (t > 0.8 ? 2 : 0));
  const density = Math.min(0.62, 0.34 + chapter * 0.026 + t * 0.08);

  const pool: CritterKind[][] = [
    ["slime"],
    ["slime", "hopper"],
    ["hopper", "slime"],
    ["hopper", "chaser"],
    ["chaser", "hopper", "slime"],
    ["ghosty", "chaser", "hopper"],
    ["chaser", "ghosty", "hopper", "slime"],
    ["chaser", "ghosty", "hopper"],
  ];
  const kinds = pool[Math.min(pool.length - 1, chapter)];
  const count = Math.min(7, 2 + Math.floor(chapter * 0.7) + Math.round(t * 2));
  const critters: CritterKind[] = [];
  for (let i = 0; i < count; i++) critters.push(kinds[i % kinds.length]);

  // 第 4 章起隔几关来一次「找出口」;最后一章每 4 关一次泡泡王
  let goal: GoalKind = "clear";
  if (chapter >= 3 && within % 4 === 2) goal = "exit";
  if (chapter === 7 && within % 4 === 3) {
    goal = "boss";
    critters.push("boss");
  }

  const seconds = 90 + chapter * 8 + (goal === "boss" ? 40 : 0) + (goal === "exit" ? 15 : 0);

  const starters: ItemKind[] = [];
  if (chapter >= 1) starters.push("fire");
  if (chapter >= 3) starters.push("bomb");
  if (chapter >= 5) starters.push("speed");
  if (chapter >= 6) starters.push("kick");

  return {
    w,
    h,
    density,
    critters,
    goal,
    seconds,
    starters,
    pierce: chapter === 7 && goal === "boss",
    richness: 0.8 + chapter * 0.06,
  };
}

/** 关号(0 基)→ 章节下标 */
export function chapterOfLevel(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

/** 关号(0 基)→ 章内序号 */
export function withinChapter(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    if (level < acc + CHAPTERS[i].size) return level - acc;
    acc += CHAPTERS[i].size;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// 生成
// ---------------------------------------------------------------------------

const HINTS = [
  "放下炸弹先想好往哪躲,拐角后面最安全。",
  "先炸开一条直路,跑起来才有回旋的余地。",
  "火力越长越要小心,自己的爆风一样会把你包起来。",
  "小怪都怕爆风,把它们赶进死胡同再点火。",
  "捡到踢炸弹以后,可以把炸弹踹进走廊深处。",
  "遥控引爆最适合埋伏:先摆好,等小怪走过来再按。",
  "限时紧的时候用连锁:一颗点着一串,省时间。",
  "泡泡王要连着包三层,每包一层它会跑得更快一点。",
];

/**
 * 生成第 `level` 关(0 基)。同一个关号永远得到同一张图。
 * `players` = 2 时会多摆一个出生点(双人合作闯关)。
 */
export function buildLevel(level: number, players = 1): BombLevel {
  const chapter = chapterOfLevel(level);
  const within = withinChapter(level);
  const recipe = recipeFor(chapter, within, CHAPTERS[chapter].size);
  const seed = 7717 + level * 131 + chapter * 17;
  const rand = mulberry32(seed);

  const board = pillarBoard(recipe.w, recipe.h);
  const corners = cornerSpawns(board);
  const spawns = players >= 2 ? [corners[0], corners[3]] : [corners[0]];

  const keep = new Set<number>();
  for (const s of spawns) for (const c of spawnClear(board, s)) keep.add(c);

  // 小怪从离出生点最远的那一批空地里挑,免得一开局就贴脸
  const floors: number[] = [];
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] === TILE_FLOOR && !keep.has(i)) floors.push(i);
  }
  const far = floors
    .map((cell) => ({ cell, d: dist(board, spawns[0], cell) }))
    .sort((a, b) => b.d - a.d || a.cell - b.cell)
    .slice(0, Math.max(recipe.critters.length * 3, 8))
    .map((v) => v.cell);
  const spots = shuffled(far, rand);

  const critters: Critter[] = [];
  recipe.critters.forEach((kind, i) => {
    const cell = spots.find((c) => !keep.has(c)) ?? spots[i % Math.max(1, spots.length)];
    if (cell === undefined) return;
    keep.add(cell);
    critters.push(makeCritter(i + 1, kind, cell, DIR_DOWN));
  });

  const bricks = scatterBricks(board, rand, recipe.density, keep);

  // 先保证不是死图:走不到的小怪一律挖通,再挑出口。
  // 顺序反过来的话,出口那块砖有可能正好卡在通往小怪的唯一一条路上,
  // 挖也不是(挖了出口就没了)、不挖也不是(小怪永远打不着)。
  openUp(board, spawns[0], critters, -1);

  // 出口藏在一块离出生点比较远、而且旁边就有路的砖底下
  let exit = -1;
  if (recipe.goal === "exit") {
    const open = reachable(board, spawns[0], false);
    const usable = bricks
      .filter((cell) => board.cells[cell] === TILE_SOFT && neighbors(board, cell).some((n) => open.has(n)))
      .sort((a, b) => dist(board, spawns[0], b) - dist(board, spawns[0], a) || a - b);
    if (usable.length > 0) {
      exit = usable[Math.min(usable.length - 1, randInt(rand, 0, Math.min(3, usable.length - 1)))];
    }
  }
  // 极端情况下(砖太少)找不到能藏出口的砖:降级成清怪关,绝不留一张过不了的图
  const goal: GoalKind = recipe.goal === "exit" && exit < 0 ? "clear" : recipe.goal;

  const hidden = new Map<number, ItemKind>();
  for (const cell of bricks) {
    if (cell === exit) continue;
    if (board.cells[cell] !== TILE_SOFT) continue;
    const item = rollItem(seed, cell, recipe.richness);
    if (item) hidden.set(cell, item);
  }

  return {
    index: level,
    chapter,
    board,
    spawns,
    critters,
    hidden,
    goal,
    exit,
    seconds: recipe.seconds,
    starters: recipe.starters,
    pierce: recipe.pierce,
    richness: recipe.richness,
    seed,
    hint: HINTS[level % HINTS.length],
  };
}

/** 曼哈顿距离(生成器内部用,不走 logic 的 world) */
function dist(board: Board, a: number, b: number): number {
  const ax = a % board.w;
  const ay = Math.floor(a / board.w);
  const bx = b % board.w;
  const by = Math.floor(b / board.w);
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * 把「隔着砖也走不到」的目标挖通:
 * 从出生点做一次「砖当空地」的可达性搜索,把通往目标的那条路上的砖清掉一格一格地挖,
 * 直到出生点能纯靠空地走到每一只小怪和出口。
 *
 * 现实里几乎不会触发(柱子布局天然连通),但生成器必须给出这个保证——
 * 一张走不到目标的图会让孩子白白耗完整个限时。
 */
export function openUp(board: Board, spawn: number, critters: readonly Critter[], exit: number): void {
  const targets = [...critters.map((c) => c.pos)];
  if (exit >= 0) targets.push(exit);
  for (const target of targets) {
    let guard = 0;
    while (guard++ < 200) {
      const open = reachable(board, spawn, false);
      // 出口藏在砖底下:能走到它的任一邻格就算够得着
      const ok =
        target === exit ? neighbors(board, target).some((n) => open.has(n)) || open.has(target) : open.has(target);
      if (ok) break;
      const path = bfsThroughBricks(board, spawn, target);
      const brick = path.find((c) => board.cells[c] === TILE_SOFT && c !== exit);
      if (brick === undefined) break;
      board.cells[brick] = TILE_FLOOR;
    }
  }
}

/** 把软砖当成可穿的路做 BFS,返回从 spawn 到 target 的路径(不含 spawn) */
function bfsThroughBricks(board: Board, spawn: number, target: number): number[] {
  const prev = new Map<number, number>();
  const seen = new Set<number>([spawn]);
  const queue = [spawn];
  while (queue.length > 0) {
    const cell = queue.shift() as number;
    if (cell === target) break;
    for (const nb of neighbors(board, cell)) {
      if (seen.has(nb) || board.cells[nb] === TILE_HARD) continue;
      seen.add(nb);
      prev.set(nb, cell);
      queue.push(nb);
    }
  }
  if (!seen.has(target)) return [];
  const path: number[] = [];
  let cur = target;
  while (cur !== spawn) {
    path.push(cur);
    const p = prev.get(cur);
    if (p === undefined) break;
    cur = p;
  }
  return path.reverse();
}

// ---------------------------------------------------------------------------
// 对战 / 无尽 / 合作
// ---------------------------------------------------------------------------

/** 对战擂台:对称的小场地,两人分踞对角,砖块左右镜像所以谁都不吃亏 */
export function buildArena(round: number, players = 2): BombLevel {
  const seed = 4211 + round * 97;
  const rand = mulberry32(seed);
  const board = pillarBoard(11, 11);
  const corners = cornerSpawns(board);
  const spawns = corners.slice(0, Math.max(2, Math.min(4, players)));

  const keep = new Set<number>();
  for (const s of spawns) for (const c of spawnClear(board, s)) keep.add(c);

  // 只在左半边撒砖,再镜像到右半边,保证完全对称
  for (let y = 1; y < board.h - 1; y++) {
    for (let x = 1; x <= (board.w - 1) / 2; x++) {
      const cell = idx(board, x, y);
      if (board.cells[cell] !== TILE_FLOOR) continue;
      const mirror = idx(board, board.w - 1 - x, board.h - 1 - y);
      if (keep.has(cell) || keep.has(mirror)) continue;
      if (rand() < 0.46) {
        board.cells[cell] = TILE_SOFT;
        if (board.cells[mirror] === TILE_FLOOR) board.cells[mirror] = TILE_SOFT;
      }
    }
  }

  const hidden = new Map<number, ItemKind>();
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] !== TILE_SOFT) continue;
    const item = rollItem(seed, i, 1.3);
    if (item) hidden.set(i, item);
  }

  return {
    index: -1,
    // 每一局换一套章节配色,连打几局也不会看腻
    chapter: (round - 1 + CHAPTERS.length) % CHAPTERS.length,
    board,
    spawns,
    critters: [],
    hidden,
    goal: "clear",
    exit: -1,
    seconds: 120,
    starters: ["fire"],
    pierce: false,
    richness: 1.3,
    seed,
    hint: "先炸开身边的砖捡道具,再去堵对手的退路。",
  };
}

/** 无尽:一张越打越大的图,靠 shrinkRing 一圈圈收缩逼两个人正面碰上 */
export function buildEndlessRound(round: number): BombLevel {
  const seed = 9001 + round * 173;
  const rand = mulberry32(seed);
  const size = oddSize(9 + Math.min(6, Math.floor(round / 2)));
  const board = pillarBoard(size, size);
  const spawns = [cornerSpawns(board)[0]];

  const keep = new Set<number>(spawnClear(board, spawns[0]));
  const floors: number[] = [];
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] === TILE_FLOOR && !keep.has(i)) floors.push(i);
  }
  const far = floors
    .map((cell) => ({ cell, d: dist(board, spawns[0], cell) }))
    .sort((a, b) => b.d - a.d || a.cell - b.cell)
    .slice(0, 12)
    .map((v) => v.cell);
  const spots = shuffled(far, rand);

  const kinds: CritterKind[] = ["slime", "hopper", "chaser", "ghosty"];
  // 轮次越高解锁越难缠的小怪,同一轮里两种交替出场
  const tier = Math.min(kinds.length - 1, Math.floor(round / 3));
  const count = Math.min(6, 1 + Math.floor(round / 2));
  const critters: Critter[] = [];
  for (let i = 0; i < count; i++) {
    const cell = spots.find((c) => !keep.has(c));
    if (cell === undefined) break;
    keep.add(cell);
    critters.push(makeCritter(i + 1, kinds[Math.max(0, tier - (i % 2))], cell, DIR_DOWN));
  }

  scatterBricks(board, rand, 0.4, keep);
  openUp(board, spawns[0], critters, -1);

  const hidden = new Map<number, ItemKind>();
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] !== TILE_SOFT) continue;
    const item = rollItem(seed, i, 1.2);
    if (item) hidden.set(i, item);
  }

  return {
    index: -1,
    chapter: Math.min(CHAPTERS.length - 1, Math.floor(round / 3)),
    board,
    spawns,
    critters,
    hidden,
    goal: "clear",
    exit: -1,
    seconds: 0,
    starters: round > 3 ? ["fire", "bomb"] : ["fire"],
    pierce: false,
    richness: 1.2,
    seed,
    hint: "场地会一圈圈缩小,早点往中间靠。",
  };
}

/** 双人合作闯关:和单人同一张图,只是多一个出生点、时间宽一点 */
export function buildCoopLevel(level: number): BombLevel {
  const lv = buildLevel(level, 2);
  return { ...lv, seconds: Math.round(lv.seconds * 1.25) };
}

// ---------------------------------------------------------------------------
// 章节小结(HUD 与结算里显示)
// ---------------------------------------------------------------------------

export function goalText(goal: GoalKind): string {
  if (goal === "exit") return "炸开砖找到出口,走过去就过关";
  if (goal === "boss") return "把泡泡王连包三层泡泡";
  return "把场上的小怪全部包成泡泡";
}

/** 全部 188 关的关号(给单测遍历用) */
export const ALL_LEVELS: number[] = Array.from({ length: TOTAL_LEVELS }, (_, i) => i);
