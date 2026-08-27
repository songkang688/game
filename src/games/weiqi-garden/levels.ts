/**
 * 围子花园 · 188 关
 *
 * 8 章 × 章节大小之和恒等于 188:24 + 24 + 24 + 24 + 22 + 22 + 24 + 24。
 *
 * 每一关都是「摆好的盘面 + 一个能被程序验证的目标」。
 * 盘面由固定模板按确定性位置盖出来,所以同一关每次打开长得一模一样;
 * `levelSolutions()` 会把「立刻达成目标的合法点」全列出来,
 * `levels.test.ts` 对 188 关逐关断言这个集合非空 —— 每题都有解。
 */
import { assertTotal, mulberry32, type Chapter } from "../level99";
import {
  BLACK,
  EMPTY,
  WHITE,
  cloneBoard,
  createBoard,
  formatRows,
  groupAt,
  neighborTable,
  parseRows,
  pointOf,
  type Board,
  type BoardSize,
  type Color
} from "./board";
import { autoDeadStones, twoEyes } from "./life";
import { koPoint, play, legalMoves, type ScoreRule } from "./rules";
import { damePoints } from "./score";

export const CHAPTERS: Chapter[] = [
  { name: "气的花园", emoji: "🌱", color: "#E8F3DC", desc: "先认识气:围住最后一口气,就能把子请回篮子。", size: 24 },
  { name: "真眼学堂", emoji: "👀", color: "#E4EEF8", desc: "做出两只真眼,这块棋就永远活着。", size: 24 },
  { name: "打劫入门", emoji: "🔁", color: "#F6E8F2", desc: "劫是要来回争的,提完得先缓一手。", size: 24 },
  { name: "死活小品", emoji: "🎭", color: "#F8EFE0", desc: "被围住也别慌,找到那个关键点就能活。", size: 24 },
  { name: "数子练习", emoji: "🧮", color: "#E9E8F6", desc: "把单官填干净,再数子 + 围空。", size: 22 },
  { name: "点目标死", emoji: "🏷️", color: "#F3E9E2", desc: "换成数目法:先标出走不掉的子,再数空目。", size: 22 },
  { name: "十三路原野", emoji: "🌾", color: "#EDF4E6", desc: "棋盘变大了,局部的手筋还是同一套。", size: 24 },
  { name: "十九路星空", emoji: "✨", color: "#E6E9F5", desc: "十九路上做局部题,顺手认认星位。", size: 24 }
];

assertTotal(CHAPTERS, 188, "weiqi-garden");

export type LevelKind = "capture" | "eye" | "ko" | "lifeDeath" | "dame" | "markDead" | "battle";

export const KIND_LABELS: Record<LevelKind, string> = {
  capture: "提子题",
  eye: "做眼题",
  ko: "打劫题",
  lifeDeath: "死活题",
  dame: "官子题",
  markDead: "标死子",
  battle: "对局任务"
};

export interface WeiqiLevel {
  /** 0 基关号 */
  index: number;
  chapterIndex: number;
  kind: LevelKind;
  size: BoardSize;
  rule: ScoreRule;
  /** 初始盘面,`.` 空 `X` 黑 `O` 白 */
  rows: string[];
  /** 该谁走(闯关一律鸭梨执黑先走) */
  turn: Color;
  /** 提子题 / 对局任务要提到几颗 */
  need: number;
  /** 做眼题 / 死活题里要救活的那块棋(给一颗子的位置) */
  target: number | null;
  /** 手数上限,超了这一关就重来 */
  moveBudget: number;
  /** 三星门槛:几手之内完成 */
  parMoves: number;
  title: string;
  task: string;
  /** 只讲方法,不写答案 */
  hint: string;
}

// ---------------------------------------------------------------------------
// 模板与盖章
// ---------------------------------------------------------------------------

/** 模板字符:`X` 黑 `O` 白 `.` 强制空 `#` 强制空且是参考解 `T` 黑且是目标块 ` ` 不动 */
type Stamp = readonly string[];

/**
 * 模板贴在哪儿:
 * - `free` 摆在盘内任何位置都成立;
 * - `edge` 必须贴着一条边(旋转 0/1/2/3 依次对应 上 / 右 / 下 / 左);
 * - `corner` 必须贴着一个角(旋转 0/1/2/3 依次对应 左上 / 右上 / 右下 / 左下)。
 */
type Anchor = "free" | "edge" | "corner";

interface StampDef {
  rows: Stamp;
  anchor: Anchor;
}

function stampSize(tpl: Stamp): { w: number; h: number } {
  return { w: Math.max(...tpl.map((r) => r.length)), h: tpl.length };
}

/** 顺时针转 90 度 */
export function rotateStamp(tpl: Stamp): string[] {
  const { w, h } = stampSize(tpl);
  const out: string[] = [];
  for (let x = 0; x < w; x++) {
    let row = "";
    for (let y = h - 1; y >= 0; y--) row += tpl[y][x] ?? " ";
    out.push(row);
  }
  return out;
}

/** 左右翻 */
export function mirrorStamp(tpl: Stamp): string[] {
  return tpl.map((r) => r.split("").reverse().join(""));
}

export function rotateTimes(tpl: Stamp, times: number): string[] {
  let cur = tpl.slice() as string[];
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) cur = rotateStamp(cur);
  return cur;
}

interface Stamped {
  board: Board;
  /** 模板里 `#` 标出的参考解(只作提示,真正的解由 levelSolutions 算) */
  marks: number[];
  /** 模板里 `T` 标出的目标块 */
  target: number | null;
}

function applyStamp(board: Board, tpl: Stamp, ox: number, oy: number): Stamped {
  const marks: number[] = [];
  let target: number | null = null;
  for (let y = 0; y < tpl.length; y++) {
    for (let x = 0; x < tpl[y].length; x++) {
      const ch = tpl[y][x];
      if (ch === " ") continue;
      const bx = ox + x;
      const by = oy + y;
      if (bx < 0 || by < 0 || bx >= board.size || by >= board.size) continue;
      const pt = pointOf(board.size, bx, by);
      if (ch === "X") board.cells[pt] = BLACK;
      else if (ch === "T") {
        board.cells[pt] = BLACK;
        target = pt;
      } else if (ch === "O") board.cells[pt] = WHITE;
      else {
        board.cells[pt] = EMPTY;
        if (ch === "#") marks.push(pt);
      }
    }
  }
  return { board, marks, target };
}

/** 眼位空区的上限:只挨着黑棋、又不超过这么多个点的空区,当成「肚子里的眼位」不去填 */
const EYE_SPACE_LIMIT = 6;

/**
 * 在黑块外围补一圈白子,把它真的围起来(做眼题 → 死活题)。
 * 肚子里那一小片眼位不能碰,所以先把空区分成「肚子」和「外面」,
 * 只在外面那一侧、紧挨黑棋的点上摆白子。
 */
function encircleWithWhite(board: Board): void {
  const table = neighborTable(board.size);
  const seen = new Uint8Array(board.cells.length);
  const paint: number[] = [];
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] !== EMPTY || seen[i]) continue;
    const region: number[] = [];
    const stack = [i];
    seen[i] = 1;
    let touchWhite = false;
    while (stack.length) {
      const cur = stack.pop() as number;
      region.push(cur);
      for (const n of table[cur]) {
        const c = board.cells[n];
        if (c === EMPTY) {
          if (!seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        } else if (c === WHITE) touchWhite = true;
      }
    }
    const inside = !touchWhite && region.length <= EYE_SPACE_LIMIT;
    if (inside) continue;
    for (const pt of region) {
      if (table[pt].some((n) => board.cells[n] === BLACK)) paint.push(pt);
    }
  }
  for (const pt of paint) board.cells[pt] = WHITE;
}

// ---------------------------------------------------------------------------
// 模板库
// ---------------------------------------------------------------------------

/** 提子题:白棋只剩一口气,`#` 就是那口气 */
const CAPTURE_STAMPS: StampDef[] = [
  { rows: [".X.", "XO#", ".X."], anchor: "free" },
  { rows: [".XX.", "XOO#", ".XX."], anchor: "free" },
  { rows: [".XXX.", "XOOO#", ".XXX."], anchor: "free" },
  { rows: [".X.", "XOX", "XO#", ".X."], anchor: "free" },
  { rows: [".XX.", "XOO#", ".XOX", ".XX."], anchor: "free" },
  { rows: ["OO#", "XXX"], anchor: "corner" },
  { rows: ["XOO#", "XXX."], anchor: "edge" },
  { rows: [".XX.", "XOOX", "XOO#", ".XX."], anchor: "free" }
];

/** 做眼题:黑棋的眼位是三个连着的空点,`#` 是把它一分为二的关键点,`T` 标出要救活的块 */
const EYE_STAMPS: StampDef[] = [
  { rows: [".#.T", "XXXX"], anchor: "corner" },
  { rows: ["XXXXX", "T.#.X", "XXXXX"], anchor: "free" },
  { rows: ["XXXX", "T.#X", "XX.X", "XXXX"], anchor: "free" },
  { rows: ["XXXXX", "X.#.T", "XXXXX"], anchor: "free" },
  { rows: ["XXXX", "X#.X", "X.TX", "XXXX"], anchor: "free" },
  { rows: ["T.#.X", "XXXXX"], anchor: "edge" }
];

/**
 * 打劫题:黑走 `#` 提掉一颗白子,同时形成劫。
 * 这是最经典的那个形状 —— 提完之后自己也只剩一口气,对方就不能马上回提。
 */
const KO_STAMP: StampDef = { rows: [".XO.", "XO#O", ".XO."], anchor: "free" };

// ---------------------------------------------------------------------------
// 盖章位置:按 anchor 给出一串候选偏移,逐个试到题目成立为止
// ---------------------------------------------------------------------------

function offsetsFor(size: number, tpl: Stamp, anchor: Anchor, rot: number, rand: () => number): Array<{ ox: number; oy: number }> {
  const { w, h } = stampSize(tpl);
  const maxX = Math.max(0, size - w);
  const maxY = Math.max(0, size - h);
  const r = ((rot % 4) + 4) % 4;
  if (anchor === "corner") {
    const corners = [
      { ox: 0, oy: 0 },
      { ox: maxX, oy: 0 },
      { ox: maxX, oy: maxY },
      { ox: 0, oy: maxY }
    ];
    return [corners[r]];
  }
  const spread = (max: number): number[] => {
    const list: number[] = [];
    for (let i = 0; i <= max; i++) list.push(i);
    // 确定性打散,保证同一关每次拿到同一串候选
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list.slice(0, 14);
  };
  if (anchor === "edge") {
    // 旋转 0/1/2/3 → 贴着 上 / 右 / 下 / 左
    if (r === 0) return spread(maxX).map((ox) => ({ ox, oy: 0 }));
    if (r === 1) return spread(maxY).map((oy) => ({ ox: maxX, oy }));
    if (r === 2) return spread(maxX).map((ox) => ({ ox, oy: maxY }));
    return spread(maxY).map((oy) => ({ ox: 0, oy }));
  }
  const xs = spread(maxX);
  const ys = spread(maxY);
  const out: Array<{ ox: number; oy: number }> = [];
  for (let i = 0; i < Math.max(xs.length, ys.length); i++) {
    out.push({ ox: xs[i % xs.length], oy: ys[i % ys.length] });
  }
  return out;
}

/** 挑一个「题目真的成立」的位置盖章;万一都不成立就退回第一个位置,由单测兜底暴露 */
function placeStamp(
  size: BoardSize,
  def: StampDef,
  rot: number,
  seed: number,
  encircle: boolean,
  ok: (st: Stamped) => boolean
): Stamped {
  const tpl = rotateTimes(def.rows, rot);
  const rand = mulberry32(seed);
  const spots = offsetsFor(size, tpl, def.anchor, rot, rand);
  let first: Stamped | null = null;
  for (const spot of spots) {
    const board = createBoard(size);
    const st = applyStamp(board, tpl, spot.ox, spot.oy);
    if (encircle) encircleWithWhite(st.board);
    if (!first) first = st;
    if (ok(st)) return st;
  }
  return first as Stamped;
}

// ---------------------------------------------------------------------------
// 各章生成
// ---------------------------------------------------------------------------

function captureLevel(size: BoardSize, seed: number, variant: number): Stamped {
  const def = CAPTURE_STAMPS[variant % CAPTURE_STAMPS.length];
  const rot = Math.floor(variant / CAPTURE_STAMPS.length) % 4;
  return placeStamp(size, def, rot, seed, false, (st) => captureSolutions(st.board, whiteAtariCount(st.board)).length > 0);
}

function eyeLevel(size: BoardSize, seed: number, variant: number, encircle: boolean): Stamped {
  const def = EYE_STAMPS[variant % EYE_STAMPS.length];
  const rot = Math.floor(variant / EYE_STAMPS.length) % 4;
  return placeStamp(size, def, rot, seed, encircle, (st) => aliveSolutions(st.board, st.target).length > 0);
}

function koLevel(size: BoardSize, seed: number, variant: number): Stamped {
  return placeStamp(size, KO_STAMP, variant % 4, seed, false, (st) => koSolutions(st.board).length > 0);
}

/**
 * 官子题:一道黑墙、一道白墙,中间留几个「两边都挨着」的空点,那就是单官。
 * 墙的位置与缺口数量随关号变化。
 */
function dameLevel(size: BoardSize, seed: number, gaps: number): Stamped {
  const rand = mulberry32(seed);
  const board = createBoard(size);
  const wall = 2 + Math.floor(rand() * Math.max(1, size - 5));
  const rows = new Set<number>();
  while (rows.size < Math.min(gaps, size)) rows.add(Math.floor(rand() * size));
  for (let y = 0; y < size; y++) {
    board.cells[pointOf(size, wall, y)] = BLACK;
    if (rows.has(y)) board.cells[pointOf(size, wall + 2, y)] = WHITE;
    else board.cells[pointOf(size, wall + 1, y)] = WHITE;
  }
  return { board, marks: Array.from(rows).map((y) => pointOf(size, wall + 1, y)), target: null };
}

/**
 * 标死子题:一盘已经下完的九路棋。
 * 左半边整片是鸭梨的黑棋、右半边整片是康康的白棋,两边各自留了两只真眼所以都活着;
 * 各自的地里再困住对方几颗**做不出眼、也逃不出去**的子 —— 那几颗就是要标死的。
 * 黑地底下还留了一小块空地,让两边的目数不一样,数出来才有胜负。
 */
function markDeadLevel(size: BoardSize, seed: number, count: number): Stamped {
  const rand = mulberry32(seed);
  const wall = 3 + Math.floor(rand() * 2); // 黑白分界线:黑占 x ≤ wall
  const eyeTop = Math.floor(rand() * 2); // 黑的两只眼从第几行开始
  const pocket = 2 + Math.floor(rand() * 2); // 黑地底下留几个空点
  const blackTrapped = Math.max(1, Math.min(3, count));
  const whiteTrapped = Math.max(1, blackTrapped - 1);

  const board = createBoard(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      board.cells[pointOf(size, x, y)] = x <= wall ? BLACK : WHITE;
    }
  }
  // 两边各挖两只真眼:一只眼一个点,中间隔开一格,免得连成一片大眼
  board.cells[pointOf(size, 0, eyeTop)] = EMPTY;
  board.cells[pointOf(size, 0, eyeTop + 2)] = EMPTY;
  board.cells[pointOf(size, size - 1, eyeTop)] = EMPTY;
  board.cells[pointOf(size, size - 1, eyeTop + 2)] = EMPTY;
  // 黑地底下的小空地
  for (let x = 0; x < pocket; x++) board.cells[pointOf(size, x, size - 1)] = EMPTY;

  const marks: number[] = [];
  // 黑地里困着的白子:每颗只留一口气,做不出眼
  for (let k = 0; k < blackTrapped; k++) {
    const y = 1 + k * 3;
    if (y + 1 >= size - 1) break;
    const stone = pointOf(size, 2, y);
    board.cells[stone] = WHITE;
    board.cells[pointOf(size, 2, y + 1)] = EMPTY;
    marks.push(stone);
  }
  // 白地里困着的黑子
  for (let k = 0; k < whiteTrapped; k++) {
    const y = 1 + k * 3;
    if (y + 1 >= size - 1) break;
    const stone = pointOf(size, size - 3, y);
    board.cells[stone] = BLACK;
    board.cells[pointOf(size, size - 3, y + 1)] = EMPTY;
    marks.push(stone);
  }
  return { board, marks: marks.sort((a, b) => a - b), target: null };
}

// ---------------------------------------------------------------------------
// 关卡装配
// ---------------------------------------------------------------------------

const CAPTURE_TASKS = [
  "把只剩一口气的白子请回篮子。",
  "找到最后那口气,一手提子。",
  "白棋只差一口气,你来收官。"
];

const EYE_TASKS = ["一手做出两只真眼。", "把这块棋的眼位分成两只。", "找到那个把眼位一分为二的点。"];

function buildLevel(index: number): WeiqiLevel {
  const chapterIndex = chapterIndexOf(index);
  const inChapter = index - chapterStartOf(chapterIndex);
  const seed = 9_000_017 + index * 7919;
  const common = { index, chapterIndex, turn: BLACK as Color, target: null as number | null };

  if (chapterIndex === 0) {
    const st = captureLevel(9, seed, inChapter);
    const need = whiteAtariCount(st.board);
    return {
      ...common,
      kind: "capture",
      size: 9,
      rule: "chinese",
      rows: formatRows(st.board),
      need,
      moveBudget: 3,
      parMoves: 1,
      title: `${KIND_LABELS.capture} 第 ${inChapter + 1} 题`,
      task: CAPTURE_TASKS[inChapter % CAPTURE_TASKS.length],
      hint: "先数一数白棋还剩几口气,只剩一口的时候,堵上那一口就提到了。"
    };
  }

  if (chapterIndex === 1 || chapterIndex === 3) {
    const encircle = chapterIndex === 3;
    const st = eyeLevel(9, seed, inChapter, encircle);
    return {
      ...common,
      kind: encircle ? "lifeDeath" : "eye",
      size: 9,
      rule: "chinese",
      rows: formatRows(st.board),
      need: 0,
      target: st.target,
      moveBudget: 3,
      parMoves: 1,
      title: `${encircle ? KIND_LABELS.lifeDeath : KIND_LABELS.eye} 第 ${inChapter + 1} 题`,
      task: encircle ? "这块棋被围住了,一手让它活过来。" : EYE_TASKS[inChapter % EYE_TASKS.length],
      hint: "先看这块棋的眼位有几个空点,再想想下在哪里能把它们隔成互不相通的两块。"
    };
  }

  if (chapterIndex === 2) {
    const st = koLevel(9, seed, inChapter);
    return {
      ...common,
      kind: "ko",
      size: 9,
      rule: "chinese",
      rows: formatRows(st.board),
      need: 1,
      moveBudget: 3,
      parMoves: 1,
      title: `${KIND_LABELS.ko} 第 ${inChapter + 1} 题`,
      task: "提掉那颗白子,把劫先手拿到手上。",
      hint: "提劫的那一手,自己也只会剩一口气 —— 所以对方不能马上提回来,得先去别处找劫材。"
    };
  }

  if (chapterIndex === 4) {
    const gaps = 1 + (inChapter % 3);
    const st = dameLevel(9, seed, gaps);
    return {
      ...common,
      kind: "dame",
      size: 9,
      rule: "chinese",
      rows: formatRows(st.board),
      need: gaps,
      moveBudget: gaps + 3,
      parMoves: gaps,
      title: `${KIND_LABELS.dame} 第 ${inChapter + 1} 题`,
      task: `把 ${gaps} 个单官填干净,再看数子结果。`,
      hint: "两边都挨得着的空点就是单官,填了不亏也不赚,但不填就数不清。"
    };
  }

  if (chapterIndex === 5) {
    const count = 1 + (inChapter % 3);
    const st = markDeadLevel(9, seed, count);
    return {
      ...common,
      kind: "markDead",
      size: 9,
      rule: "japanese",
      rows: formatRows(st.board),
      need: st.marks.length,
      moveBudget: st.marks.length + 4,
      parMoves: st.marks.length,
      title: `${KIND_LABELS.markDead} 第 ${inChapter + 1} 题`,
      task: "把走不掉的那几颗子都标出来,数目法就能算了。",
      hint: "一块棋做不出两只真眼、周围又全是对方的地,那它就走不掉了。"
    };
  }

  // 第 7 / 8 章:13 路与 19 路,局部题 + 对局任务
  const size: BoardSize = chapterIndex === 6 ? 13 : 19;
  const slot = inChapter % 4;
  if (slot === 0 || slot === 3) {
    const st = captureLevel(size, seed, inChapter);
    const need = whiteAtariCount(st.board);
    const battle = slot === 3;
    return {
      ...common,
      kind: battle ? "battle" : "capture",
      size,
      rule: "chinese",
      rows: formatRows(st.board),
      need,
      moveBudget: battle ? 8 : 3,
      parMoves: 1,
      title: `${battle ? KIND_LABELS.battle : KIND_LABELS.capture} 第 ${inChapter + 1} 题`,
      task: battle ? `康康会还手,在 8 手之内提到 ${need} 颗白子。` : CAPTURE_TASKS[inChapter % CAPTURE_TASKS.length],
      hint: battle
        ? "先把能提的提掉,对方还手之后再数一遍气,别急着追。"
        : "棋盘变大不影响数气,先看清这块白棋还剩几口。"
    };
  }
  if (slot === 1) {
    const st = eyeLevel(size, seed, inChapter, true);
    return {
      ...common,
      kind: "lifeDeath",
      size,
      rule: "chinese",
      rows: formatRows(st.board),
      need: 0,
      target: st.target,
      moveBudget: 3,
      parMoves: 1,
      title: `${KIND_LABELS.lifeDeath} 第 ${inChapter + 1} 题`,
      task: "大棋盘上的小死活:一手让这块棋活过来。",
      hint: "眼位是几个空点连在一起,就想办法把它们隔断成两只。"
    };
  }
  const st = koLevel(size, seed, inChapter);
  return {
    ...common,
    kind: "ko",
    size,
    rule: "chinese",
    rows: formatRows(st.board),
    need: 1,
    moveBudget: 3,
    parMoves: 1,
    title: `${KIND_LABELS.ko} 第 ${inChapter + 1} 题`,
    task: "先把劫提到手,再去别处找劫材。",
    hint: "提劫之后自己也只剩一口气,别忘了对方不能马上提回来。"
  };
}

/** 盘上处于「只剩一口气」的白子总数 */
function whiteAtariCount(board: Board): number {
  let n = 0;
  const seen = new Set<number>();
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] !== WHITE || seen.has(i)) continue;
    const g = groupAt(board, i);
    if (!g) continue;
    for (const s of g.stones) seen.add(s);
    if (g.liberties.length === 1) n += g.stones.length;
  }
  return Math.max(1, n);
}

// ---------------------------------------------------------------------------
// 章节工具(本地版,免得每次都传 CHAPTERS)
// ---------------------------------------------------------------------------

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

const CACHE = new Map<number, WeiqiLevel>();

/** 取第 index 关(0 基)。同一关每次拿到的盘面完全一样。 */
export function levelAt(index: number): WeiqiLevel {
  const lv = Math.max(0, Math.min(187, Math.floor(index)));
  const hit = CACHE.get(lv);
  if (hit) return hit;
  const built = buildLevel(lv);
  CACHE.set(lv, built);
  return built;
}

export function levelBoard(level: WeiqiLevel): Board {
  return parseRows(level.rows);
}

// ---------------------------------------------------------------------------
// 有解验证:每一关都要能算出至少一个正确答案
// ---------------------------------------------------------------------------

/** 目标块在这个盘面上是不是活了(target 指向的那块棋有两只真眼) */
export function targetAlive(board: Board, target: number | null): boolean {
  if (target === null) return false;
  const g = groupAt(board, target);
  return g ? twoEyes(board, g) : false;
}

/** 一手能提到 need 颗白子的黑棋落点 */
export function captureSolutions(board: Board, need: number): number[] {
  const out: number[] = [];
  for (const pt of legalMoves(board, BLACK)) {
    const res = play(board, pt, BLACK);
    if (res && res.captured.length >= need) out.push(pt);
  }
  return out;
}

/** 一手之后目标块就有两只真眼的黑棋落点 */
export function aliveSolutions(board: Board, target: number | null): number[] {
  if (target === null) return [];
  const out: number[] = [];
  for (const pt of legalMoves(board, BLACK)) {
    const res = play(board, pt, BLACK);
    if (res && targetAlive(res.board, target)) out.push(pt);
  }
  return out;
}

/** 一手提子并且形成劫的黑棋落点 */
export function koSolutions(board: Board): number[] {
  const out: number[] = [];
  for (const pt of legalMoves(board, BLACK)) {
    const res = play(board, pt, BLACK);
    if (res && res.captured.length >= 1 && koPoint(board, res.board, pt, res.captured) !== null) out.push(pt);
  }
  return out;
}

/**
 * 一关的全部正确解(立刻达成目标的合法点)。
 * - 提子题 / 对局任务:一手提到 need 颗
 * - 做眼题 / 死活题:一手之后目标块两眼活棋
 * - 打劫题:一手提子并形成劫
 * - 官子题:当前所有单官
 * - 标死子:所有该判死的子
 */
export function levelSolutions(level: WeiqiLevel): number[] {
  const board = levelBoard(level);
  if (level.kind === "dame") return damePoints(board);
  if (level.kind === "markDead") return autoDeadStones(board);
  if (level.kind === "capture" || level.kind === "battle") return captureSolutions(board, level.need);
  if (level.kind === "ko") return koSolutions(board);
  return aliveSolutions(board, level.target);
}

/** 这一关的星级:按用了几手评,越少越好 */
export function starsFor(level: WeiqiLevel, usedMoves: number): 1 | 2 | 3 {
  if (usedMoves <= level.parMoves) return 3;
  if (usedMoves <= level.parMoves + 1) return 2;
  return 1;
}

/** 闯关进行中的判定:当前盘面 + 累计提子 + 已标死子,够不够格过关 */
export function levelCleared(
  level: WeiqiLevel,
  board: Board,
  capturedTotal: number,
  markedDead: readonly number[] = []
): boolean {
  // 打劫题的目标就是「先把劫提到手上」,提到那颗子就算走对了
  if (level.kind === "capture" || level.kind === "battle" || level.kind === "ko") {
    return capturedTotal >= level.need;
  }
  if (level.kind === "dame") return damePoints(board).length === 0;
  if (level.kind === "markDead") {
    const want = autoDeadStones(board);
    if (want.length === 0) return false;
    const got = new Set(markedDead);
    return want.length === got.size && want.every((p) => got.has(p));
  }
  return targetAlive(board, level.target);
}

/** 关卡列表的一句话总结(选关地图与攻略共用) */
export function levelSummary(level: WeiqiLevel): string {
  return `${level.size} 路 · ${KIND_LABELS[level.kind]} · ${level.task}`;
}

/** 给测试与调试用:整关克隆一份盘面 */
export function cloneLevelBoard(level: WeiqiLevel): Board {
  return cloneBoard(levelBoard(level));
}
