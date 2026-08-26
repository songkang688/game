/**
 * 找不同 · 1.2 场景层与公平性校验器。
 *
 * 1.0/1.1 的生成器（`levels.ts`）只会做一种差异：把格子里的 emoji 换掉。
 * 1.2 要求补齐六种差异类型，又必须保证**前 99 关逐字不变**，
 * 所以这里不改老生成器，而是在它的输出上再叠一层「外观」：
 *
 *   `buildBoards(level)` → emoji 层（前 99 关原样照抄）
 *        ↓ 只对第 100 关起的差异格生效
 *   `buildScene(level, round)` → CellView 层（emoji + 缩放 / 左右翻 / 底色 / 个数 / 格内位移）
 *
 * 前 99 关走这一层出来的每一格都是「默认外观 + 原来的 emoji」，
 * 也就是说画面与 1.1 完全一致，`upgrade12.test.ts` 用 SHA-256 钉死了这件事。
 *
 * 另外提供 `validateScene()`：一个不碰 DOM 的纯函数，把一关是否「可解且唯一」
 * 拆成五条硬规则逐条查，测试里跑遍 188 关全量与无尽的前若干轮。
 */
import { chapterOf, mulberry32, pick, shuffled } from "../level99";
import {
  CHAPTERS,
  LEGACY_CHAPTER_COUNT,
  LEVELS,
  THEME_POOLS,
  buildBoards,
  mirrorIndex,
  movePermutation,
  type DiffBoard,
  type DiffMode,
} from "./levels";

/** 前 6 章（1.0 时代）覆盖的关数：下标 < 这个数的关一律只用「换 emoji」 */
export const LEGACY_LEVEL_COUNT = CHAPTERS.slice(0, LEGACY_CHAPTER_COUNT).reduce((s, c) => s + c.size, 0);

/** 六种差异类型 */
export type DiffKind = "swap" | "shift" | "size" | "flip" | "count" | "tint";

/** 六种差异类型的中文名（提示与结算文案直接用） */
export const KIND_LABEL: Record<DiffKind, string> = {
  swap: "换了图案",
  shift: "挪了位置",
  size: "变了大小",
  flip: "换了朝向",
  count: "多了一个",
  tint: "换了底色",
};

/** 一格的完整呈现。两图逐格比较这六个维度，任何一个不一样就算「不同」。 */
export interface CellView {
  emoji: string;
  /** 图案缩放，1 = 原始大小 */
  scale: number;
  /** 左右翻 */
  flip: boolean;
  /** 格子底色，null = 用默认底 */
  tint: string | null;
  /** 这一格画几个图案（1 或 2） */
  count: number;
  /** 图案在格内的横向位移，单位是格宽的比例 */
  dx: number;
  /** 纵向位移，单位是格高的比例 */
  dy: number;
}

/** 图案在一格里占的比例（渲染与校验共用同一个口径，免得「看得见」这件事两头对不上） */
export const GLYPH_RATIO = 0.6;

/** 「挪位置」的位移幅度：再大图案就会被推出格子（校验器的可视区规则会拦） */
export const SHIFT_AMOUNT = 0.19;
/** 「变大小」的两档 */
export const SIZE_BIG = 1.42;
export const SIZE_SMALL = 0.66;
/** 「加减一个」：两个副本并排，各自缩到这么小才塞得下 */
export const COUNT_SCALE = 0.62;
export const COUNT_OFFSET = 0.24;

/** 「变底色」可选的几种粉彩底（都与默认底 #f6f2fb 拉得开） */
export const TINTS: readonly string[] = ["#ffe3e3", "#d8f5e6", "#fff3bf", "#dbe4ff"];

/**
 * 左右翻之后**看得出来**的 emoji。
 * 对称图案（⚽ 🔔 💎 …）翻过来跟没翻一样，拿它当差异点就是耍赖，
 * 所以「变朝向」只许落在这张表里的图案上，校验器会盯着这条。
 */
export const FLIPPABLE: ReadonlySet<string> = new Set([
  "🔍", "🗝️", "🧩", "📒", "📕", "📜",
  "🛶", "🌪️", "🎐", "🪁", "🌀",
  "🐟", "🦢", "🍃", "🌊", "🦐", "🐬",
  "🚀", "🏁", "🏅", "⏱️",
]);

/** 每章允许出现的差异类型（前 6 章永远只有换 emoji；后段混合） */
export const KIND_MENU: readonly DiffKind[][] = [
  ["swap"],
  ["swap"],
  ["swap"],
  ["swap"],
  ["swap"],
  ["swap"],
  ["swap", "size", "count"],
  ["swap", "flip", "shift"],
  ["swap", "tint", "size"],
  ["swap", "shift", "size", "flip", "count", "tint"],
];

/** 默认外观的一格 */
export function plainCell(emoji: string): CellView {
  return { emoji, scale: 1, flip: false, tint: null, count: 1, dx: 0, dy: 0 };
}

/** 两格看起来是不是一模一样 */
export function sameCell(a: CellView, b: CellView): boolean {
  return (
    a.emoji === b.emoji &&
    a.scale === b.scale &&
    a.flip === b.flip &&
    a.tint === b.tint &&
    a.count === b.count &&
    a.dx === b.dx &&
    a.dy === b.dy
  );
}

/** 一关（或无尽的一轮）摆在屏幕上的全部信息 */
export interface Scene {
  /** 0 基关号；无尽轮次用 -1 */
  level: number;
  /** 连环挑战的第几轮（其余恒为 0） */
  round: number;
  rows: number;
  cols: number;
  mode: DiffMode;
  /** 上图（三图模式的图①） */
  left: CellView[];
  /** 三图模式的图②，其余模式为 null */
  second: CellView[] | null;
  /** 下图：可点的那张 */
  right: CellView[];
  /** 下图里的答案格（升序） */
  diffIdx: number[];
  /** 三图模式的干扰格：图①②之间不同，但下图跟图①一样，点了不算对 */
  decoyIdx: number[];
  /** 与 diffIdx 一一对应的差异类型 */
  kinds: DiffKind[];
  /** 下图是不是上图的左右镜像 */
  mirrored: boolean;
  timeSec: number;
  /** 本关能用几次提示 */
  hints: number;
}

/**
 * 下图第 j 格对应上图的哪一格。
 * 镜像关是「同一行左右对调」，其余关是原位；两种换算都是对合（做两次回到原位）。
 */
export function sourceIndex(scene: Pick<Scene, "mirrored" | "cols">, j: number): number {
  return scene.mirrored ? mirrorIndex(j, scene.cols) : j;
}

/** 下图第 j 格该跟上图的哪一格比 */
function leftOf(scene: Scene, j: number): CellView {
  return scene.left[sourceIndex(scene, j)];
}

/** 图案没被换掉时，下图第 j 格本来该长什么样（镜像关要先照一次镜子） */
function originalEmoji(board: DiffBoard, j: number, mirrored: boolean, cols: number): string {
  return board.base[mirrored ? mirrorIndex(j, cols) : j];
}

/** 按类型给一格套上外观差异；`swap` 走的是老生成器换好的 emoji */
function applyKind(kind: DiffKind, original: string, swapped: string, rand: () => number): CellView {
  const cell = plainCell(kind === "swap" ? swapped : original);
  switch (kind) {
    case "swap":
      return cell;
    case "shift": {
      const dirs: Array<[number, number]> = [
        [SHIFT_AMOUNT, 0],
        [-SHIFT_AMOUNT, 0],
        [0, SHIFT_AMOUNT],
        [0, -SHIFT_AMOUNT],
      ];
      const [dx, dy] = pick(rand, dirs);
      return { ...cell, dx, dy };
    }
    case "size":
      return { ...cell, scale: rand() < 0.5 ? SIZE_BIG : SIZE_SMALL };
    case "flip":
      return { ...cell, flip: true };
    case "count":
      return { ...cell, count: 2, scale: COUNT_SCALE };
    case "tint":
      return { ...cell, tint: pick(rand, TINTS) };
  }
}

/**
 * 给一组差异格分派类型：菜单洗过牌后依次发，发完再从头轮。
 * 「变朝向」只发给翻过来看得出的图案，发不出去就顺延到菜单里的下一种。
 */
function assignKinds(menu: readonly DiffKind[], emojis: readonly string[], rand: () => number): DiffKind[] {
  const deck = shuffled(menu, rand);
  return emojis.map((emoji, k) => {
    for (let step = 0; step < deck.length; step++) {
      const kind = deck[(k + step) % deck.length];
      if (kind !== "flip" || FLIPPABLE.has(emoji)) return kind;
    }
    return "swap";
  });
}

/** 本关能用几次提示：越往后越少，用完也不阻塞过关 */
export function hintBudget(chapterIndex: number): number {
  return Math.max(1, 4 - Math.floor(Math.max(0, chapterIndex) / 2));
}

/**
 * 把某一关（连环挑战再指定第几轮）铺成 1.2 的场景。
 * 前 99 关：emoji 层原样搬过来，外观全是默认值，画面与 1.1 一模一样。
 */
export function buildScene(level: number, round = 0): Scene {
  const cfg = LEVELS[level];
  const boards = buildBoards(level);
  const board = boards[Math.min(Math.max(0, Math.round(round)), boards.length - 1)];
  const mirrored = cfg.mode === "mirror";
  const chapter = chapterOf(CHAPTERS, level);
  const scene: Scene = {
    level,
    round,
    rows: cfg.rows,
    cols: cfg.cols,
    mode: cfg.mode,
    left: board.base.map(plainCell),
    second: board.second ? board.second.map(plainCell) : null,
    right: board.changed.map(plainCell),
    diffIdx: board.diffIdx.slice(),
    decoyIdx: (board.decoyIdx ?? []).slice(),
    kinds: board.diffIdx.map(() => "swap" as DiffKind),
    mirrored,
    timeSec: cfg.timeSec,
    hints: hintBudget(chapter),
  };
  if (level < LEGACY_LEVEL_COUNT) return scene;

  const menu = KIND_MENU[Math.min(chapter, KIND_MENU.length - 1)];
  const rand = mulberry32(20251 + level * 6151 + round * 977);
  const originals = scene.diffIdx.map((j) => originalEmoji(board, j, mirrored, cfg.cols));
  scene.kinds = assignKinds(menu, originals, rand);
  scene.diffIdx.forEach((j, k) => {
    scene.right[j] = applyKind(scene.kinds[k], originals[k], board.changed[j], rand);
  });
  // 三图关的干扰格也换上花样，不然一眼就能靠「只有换图案的才是陷阱」蒙对
  if (scene.second) {
    const decoyKinds = assignKinds(menu, scene.decoyIdx.map((i) => board.base[i]), rand);
    scene.decoyIdx.forEach((i, k) => {
      scene.second![i] = applyKind(decoyKinds[k], board.base[i], board.second![i], rand);
    });
  }
  return scene;
}

// ---------------------------------------------------------------------------
// 无尽：找不同马拉松
// ---------------------------------------------------------------------------

/** 无尽每一轮固定 3 个差异点 */
export const ENDLESS_DIFFS = 3;

/** 网格随轮次长大的档位 */
const ENDLESS_SIZES: ReadonlyArray<[number, number]> = [
  [3, 3],
  [3, 4],
  [4, 4],
  [4, 5],
  [5, 5],
  [5, 6],
];

/** 第 round 轮的网格（轮次越高格子越多，绝不回头） */
export function endlessSize(round: number): { rows: number; cols: number } {
  const tier = Math.min(ENDLESS_SIZES.length - 1, Math.max(0, Math.floor((round - 1) / 4)));
  const [rows, cols] = ENDLESS_SIZES[tier];
  return { rows, cols };
}

/** 第 round 轮的可用时间（秒）：越往后越紧，但不低于 20 秒 */
export function endlessTime(round: number): number {
  return Math.max(20, 46 - Math.floor((round - 1) * 1.5));
}

/** 第 round 轮里「双胞胎替换」占的比例（0–1，单调上升） */
export function endlessLookalikeRatio(round: number): number {
  return Math.min(1, Math.max(0, (round - 1) / 10));
}

/** 第 round 轮解锁到的差异类型（只增不减） */
export function endlessKinds(round: number): DiffKind[] {
  const ladder: DiffKind[] = ["swap", "size", "tint", "flip", "shift", "count"];
  const unlocked = Math.min(ladder.length, 1 + Math.floor(Math.max(0, round - 1) / 3));
  return ladder.slice(0, unlocked);
}

/** 无尽第 round 轮的完整场景（确定性：同一轮重开长得一样） */
export function buildEndlessScene(round: number): Scene {
  const r = Math.max(1, Math.round(round));
  const { rows, cols } = endlessSize(r);
  const n = rows * cols;
  const theme = (r - 1) % THEME_POOLS.length;
  const pool = THEME_POOLS[theme];
  const rand = mulberry32(30011 + r * 7717);
  const baseEmoji = Array.from({ length: n }, () => pick(rand, pool));
  const order = shuffled(
    Array.from({ length: n }, (_, i) => i),
    rand
  );
  const diffIdx = order.slice(0, ENDLESS_DIFFS).sort((a, b) => a - b);
  const menu = endlessKinds(r);
  const ratio = endlessLookalikeRatio(r);
  const kinds = assignKinds(menu, diffIdx.map((i) => baseEmoji[i]), rand);
  const left = baseEmoji.map(plainCell);
  const right = baseEmoji.map(plainCell);
  diffIdx.forEach((i, k) => {
    const twin = LOOKALIKE_ENDLESS[baseEmoji[i]];
    const useTwin = twin !== undefined && pool.includes(twin) && rand() < ratio;
    const swapped = useTwin ? twin : pick(rand, pool.filter((e) => e !== baseEmoji[i]));
    right[i] = applyKind(kinds[k], baseEmoji[i], swapped, rand);
  });
  return {
    level: -1,
    round: r,
    rows,
    cols,
    mode: "classic",
    left,
    second: null,
    right,
    diffIdx,
    decoyIdx: [],
    kinds,
    mirrored: false,
    timeSec: endlessTime(r),
    hints: 1,
  };
}

/** 无尽用的双胞胎表：与 levels.ts 的那张同口径，但不去动只读的老表 */
const LOOKALIKE_ENDLESS: Record<string, string> = {
  "🍰": "🎂", "🎂": "🍰", "🍭": "🍬", "🍬": "🍭", "🍩": "🍪", "🍪": "🍩",
  "⭐": "🌟", "🌟": "⭐", "✨": "🌠", "🌠": "✨",
  "⚽": "🏀", "🏀": "⚽", "🚗": "🚂", "🚂": "🚗", "✈️": "🚁", "🚁": "✈️",
  "📒": "📕", "📕": "📒", "🌀": "🌪️", "🌪️": "🌀",
  "💧": "🫧", "🫧": "💧", "🪷": "🪸", "🪸": "🪷",
  "⏱️": "⌛", "⌛": "⏱️",
};

// ---------------------------------------------------------------------------
// 公平性校验器
// ---------------------------------------------------------------------------

/** 一格的图案画出去之后，离格心最远能到格宽的几成（用来判断有没有被推出格子） */
export function cellExtent(cell: CellView): number {
  const half = (GLYPH_RATIO * cell.scale) / 2;
  const spread = cell.count > 1 ? COUNT_OFFSET : 0;
  return Math.max(Math.abs(cell.dx), Math.abs(cell.dy)) + spread + half;
}

/** 从两格的差别反推这是哪一种差异类型；完全一样返回 null */
export function kindBetween(before: CellView, after: CellView): DiffKind | null {
  if (before.emoji !== after.emoji) return "swap";
  if (before.count !== after.count) return "count";
  if (before.flip !== after.flip) return "flip";
  if (before.tint !== after.tint) return "tint";
  if (before.dx !== after.dx || before.dy !== after.dy) return "shift";
  if (before.scale !== after.scale) return "size";
  return null;
}

/** 一关声明的差异点数量（无尽固定 3 个） */
function declaredDiffs(scene: Scene): number {
  return scene.level >= 0 ? LEVELS[scene.level].diffs : ENDLESS_DIFFS;
}

/**
 * 场景公平性校验：返回一串人话写的问题，空数组表示这一关没毛病。
 *
 * 五条硬规则：
 *  ① 差异点数量 = 声明数量；
 *  ② 每个差异点都在可视区内（下标在棋盘里，图案也没被推出格子）；
 *  ③ 任意两个差异点的格距 ≥ 1（不许两个答案挤在同一格）；
 *  ④ 答案唯一：不存在「没被标记、但两图看起来确实不同」的格子；
 *  ⑤ 镜像 / 旋转关的坐标换算可逆。
 */
export function validateScene(scene: Scene): string[] {
  const bad: string[] = [];
  const where = scene.level >= 0 ? `第 ${scene.level + 1} 关` : `无尽第 ${scene.round} 轮`;
  const n = scene.rows * scene.cols;
  const say = (msg: string): void => {
    bad.push(`${where}：${msg}`);
  };

  // ① 数量
  const want = declaredDiffs(scene);
  if (scene.diffIdx.length !== want) say(`差异点声明 ${want} 个，实际生成 ${scene.diffIdx.length} 个`);
  if (scene.kinds.length !== scene.diffIdx.length) say("差异类型的条数与差异点对不上");
  if (scene.left.length !== n || scene.right.length !== n) say("棋盘格数与 rows×cols 对不上");
  if (scene.second && scene.second.length !== n) say("图②的格数与 rows×cols 对不上");

  // ② 可视区
  for (const j of scene.diffIdx) {
    if (!Number.isInteger(j) || j < 0 || j >= n) {
      say(`差异点 ${j} 落在棋盘外`);
      continue;
    }
    const cell = scene.right[j];
    if (cellExtent(cell) > 0.5 + 1e-9) {
      say(`第 ${j} 格的图案被推出了格子（占到格宽的 ${(cellExtent(cell) * 2).toFixed(2)} 倍）`);
    }
    if (cell.count > 1 && cell.scale > 0.7) say(`第 ${j} 格塞了两个图案却没缩小，会挤成一团`);
    if (cell.scale < 0.5 || cell.scale > 1.5) say(`第 ${j} 格的缩放 ${cell.scale} 越界`);
  }

  // ③ 格距（同一格里不许并列两个答案）
  const seen = new Set<number>();
  for (const j of scene.diffIdx) {
    if (seen.has(j)) say(`第 ${j} 格被算成了两个答案`);
    seen.add(j);
  }

  // ④ 答案唯一 + 差异类型自洽
  const answers = new Set(scene.diffIdx);
  const decoys = new Set(scene.decoyIdx);
  for (let j = 0; j < n; j++) {
    const mine = scene.right[j];
    const ref = leftOf(scene, j);
    const differsFromLeft = !sameCell(mine, ref);
    const differsFromSecond = scene.second ? !sameCell(mine, scene.second[j]) : differsFromLeft;
    const isAnswer = differsFromLeft && differsFromSecond;
    if (answers.has(j) && !isAnswer) say(`第 ${j} 格被标成答案，可两图看起来一样`);
    if (!answers.has(j) && isAnswer) say(`第 ${j} 格没被标记，但两图确实不同（答案不唯一）`);
    if (decoys.has(j) && answers.has(j)) say(`第 ${j} 格既是答案又是干扰格`);
  }
  scene.diffIdx.forEach((j, k) => {
    if (j < 0 || j >= n) return;
    const got = kindBetween(leftOf(scene, j), scene.right[j]);
    if (got === null) return;
    if (got !== scene.kinds[k]) say(`第 ${j} 格声明的是「${scene.kinds[k]}」，实际改的是「${got}」`);
    if (scene.kinds[k] === "flip" && !FLIPPABLE.has(scene.right[j].emoji)) {
      say(`第 ${j} 格用左右翻做差异，可 ${scene.right[j].emoji} 翻过来看不出区别`);
    }
    if (scene.kinds[k] === "tint" && scene.right[j].tint === null) say(`第 ${j} 格声明变底色却没上色`);
  });
  if (scene.second) {
    for (const i of scene.decoyIdx) {
      if (sameCell(scene.second[i], scene.left[i])) say(`干扰格 ${i} 在图①②之间根本没变`);
      if (!sameCell(scene.right[i], scene.left[i])) say(`干扰格 ${i} 在下图也变了，会变成第二个答案`);
    }
  }

  // ⑤ 坐标换算可逆
  for (let j = 0; j < n; j++) {
    if (sourceIndex(scene, sourceIndex(scene, j)) !== j) say(`第 ${j} 格的坐标换算不可逆`);
  }
  if (scene.mode === "moving") {
    for (const step of [1, 2, 3, 7]) {
      const perm = movePermutation(scene.rows, scene.cols, step);
      if (perm.length !== n || new Set(perm).size !== n) {
        say(`第 ${step} 次换位不是双射，会把格子弄丢`);
        continue;
      }
      const inv = new Array<number>(n);
      perm.forEach((src, pos) => {
        inv[src] = pos;
      });
      for (let i = 0; i < n; i++) {
        if (perm[inv[i]] !== i) say(`第 ${step} 次换位的逆映射对不上（格 ${i}）`);
      }
    }
  }
  return bad;
}

/** 把 188 关（连环挑战的每一轮都算）全跑一遍，返回全部问题 */
export function validateAllLevels(): string[] {
  const out: string[] = [];
  for (let level = 0; level < LEVELS.length; level++) {
    const rounds = Math.max(1, LEVELS[level].rounds);
    for (let round = 0; round < rounds; round++) {
      out.push(...validateScene(buildScene(level, round)));
    }
  }
  return out;
}
