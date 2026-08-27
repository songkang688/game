/**
 * 军旗对决 · 棋盘几何。
 *
 * 12 行 × 5 列 = 60 格。行 0–5 是康康那半边，行 6–11 是鸭梨这半边，
 * 中间第 5 行与第 6 行之间是前沿：只有第 0、2、4 列能过去，第 1、3 列是走不通的山界。
 *
 * 这里只放「地图长什么样」：格子编号、铁路图、公路图、行营、大本营、画线用的连线表。
 * 棋子大小、怎么撞、谁赢，全在 rules.ts。
 */

export const ROWS = 12;
export const COLS = 5;
export const CELLS = ROWS * COLS;

/** 格子编号：0 号在左上角，往右加一，换行加五 */
export type Pos = number;

/** 鸭梨坐在下半边（行 6–11），康康坐在上半边（行 0–5） */
export type Side = "duo" | "star";

export const SIDES: readonly Side[] = ["duo", "star"];

export function other(side: Side): Side {
  return side === "duo" ? "star" : "duo";
}

export function idx(r: number, c: number): Pos {
  return r * COLS + c;
}

export function rowOf(p: Pos): number {
  return Math.floor(p / COLS);
}

export function colOf(p: Pos): number {
  return p % COLS;
}

export function onBoard(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

/** 这一格属于哪半边 */
export function halfOf(p: Pos): Side {
  return rowOf(p) < 6 ? "star" : "duo";
}

/** 大本营：每边两个，摆在最外面那一行的第 1、3 列 */
export const HQ: Record<Side, readonly Pos[]> = {
  star: [idx(0, 1), idx(0, 3)],
  duo: [idx(11, 1), idx(11, 3)],
};

/** 行营：每边五个，摆成一个 X */
export const CAMP: Record<Side, readonly Pos[]> = {
  star: [idx(2, 1), idx(2, 3), idx(3, 2), idx(4, 1), idx(4, 3)],
  duo: [idx(7, 1), idx(7, 3), idx(8, 2), idx(9, 1), idx(9, 3)],
};

const CAMP_SET = new Set<Pos>([...CAMP.star, ...CAMP.duo]);
const HQ_SET = new Set<Pos>([...HQ.star, ...HQ.duo]);

/** 行营里的棋子撞不动，只能自己走出来 */
export function inCamp(p: Pos): boolean {
  return CAMP_SET.has(p);
}

/** 进了大本营的棋子就地休息，不能再动 */
export function inHQ(p: Pos): boolean {
  return HQ_SET.has(p);
}

/** 前沿那一行（离对方最近的一行）：炸弹开局不许放这里 */
export const FRONT_ROW: Record<Side, number> = { star: 5, duo: 6 };

/** 最后两行（离对方最远的两行）：地雷只能放这里 */
export const BACK_TWO_ROWS: Record<Side, readonly number[]> = {
  star: [0, 1],
  duo: [11, 10],
};

/** 这一边的全部格子 */
export function cellsOf(side: Side): Pos[] {
  const out: Pos[] = [];
  for (let r = side === "star" ? 0 : 6; r < (side === "star" ? 6 : 12); r++) {
    for (let c = 0; c < COLS; c++) out.push(idx(r, c));
  }
  return out;
}

/** 这一边开局能摆子的格子（行营除外，正好 25 个，和 25 枚棋子一一对上） */
export function placeableOf(side: Side): Pos[] {
  return cellsOf(side).filter((p) => !inCamp(p));
}

/** 前沿只有这三列能过 */
export const FRONT_GATES: readonly number[] = [0, 2, 4];

// ---------------------------------------------------------------------------
// 铁路
// ---------------------------------------------------------------------------

function railPairs(): Array<[Pos, Pos]> {
  const out: Array<[Pos, Pos]> = [];
  // 每边第二行是整行铁路，两条前沿也是整行铁路
  for (const r of [1, 5, 6, 10]) {
    for (let c = 0; c < COLS - 1; c++) out.push([idx(r, c), idx(r, c + 1)]);
  }
  // 左右两条竖铁路，从第 1 行一路通到第 10 行（中间穿过前沿）
  for (const c of [0, 4]) {
    for (let r = 1; r < 10; r++) out.push([idx(r, c), idx(r + 1, c)]);
  }
  // 中路只有前沿之间这一小段
  out.push([idx(5, 2), idx(6, 2)]);
  return out;
}

/** 铁路邻接表：只有铁路上的格子才有内容 */
export const RAIL_ADJ: Pos[][] = (() => {
  const adj: Pos[][] = Array.from({ length: CELLS }, () => []);
  for (const [a, b] of railPairs()) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
})();

/** 这一格在铁路上吗 */
export function isRail(p: Pos): boolean {
  return RAIL_ADJ[p].length > 0;
}

/** 两格之间有没有一段铁路 */
export function railLinked(a: Pos, b: Pos): boolean {
  return RAIL_ADJ[a].includes(b);
}

// ---------------------------------------------------------------------------
// 公路
// ---------------------------------------------------------------------------

function roadPairs(): Array<[Pos, Pos]> {
  const out: Array<[Pos, Pos]> = [];
  const seen = new Set<string>();
  const add = (a: Pos, b: Pos): void => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push([a, b]);
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = idx(r, c);
      // 同半边内正交相邻
      if (c + 1 < COLS) add(p, idx(r, c + 1));
      if (r + 1 < ROWS) {
        const crossing = r === 5;
        if (!crossing || FRONT_GATES.includes(c)) add(p, idx(r + 1, c));
      }
    }
  }
  // 行营与四个斜角互通
  for (const camp of [...CAMP.star, ...CAMP.duo]) {
    const r = rowOf(camp);
    const c = colOf(camp);
    for (const [dr, dc] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      const nr = r + dr;
      const nc = c + dc;
      if (!onBoard(nr, nc)) continue;
      if (halfOf(idx(nr, nc)) !== halfOf(camp)) continue;
      add(camp, idx(nr, nc));
    }
  }
  return out;
}

/** 公路邻接表：一步只能走到这些格子（铁路那几段也算一步能到） */
export const ROAD_ADJ: Pos[][] = (() => {
  const adj: Pos[][] = Array.from({ length: CELLS }, () => []);
  for (const [a, b] of roadPairs()) {
    adj[a].push(b);
    adj[b].push(a);
  }
  for (const list of adj) list.sort((x, y) => x - y);
  return adj;
})();

export interface BoardLine {
  a: Pos;
  b: Pos;
  /** 铁路画粗线，公路画细线 */
  rail: boolean;
  /** 行营那四条斜线要转个角度画 */
  diagonal: boolean;
}

/** 画棋盘用的连线表：一条边画一次 */
export const LINES: BoardLine[] = (() => {
  const out: BoardLine[] = [];
  const seen = new Set<string>();
  for (let a = 0; a < CELLS; a++) {
    for (const b of ROAD_ADJ[a]) {
      if (b < a) continue;
      const key = `${a}-${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        a,
        b,
        rail: railLinked(a, b),
        diagonal: rowOf(a) !== rowOf(b) && colOf(a) !== colOf(b),
      });
    }
  }
  return out;
})();

/** 读屏与提示语用的格子名，例如「第 3 行第 2 列」 */
export function cellName(p: Pos): string {
  return `第 ${rowOf(p) + 1} 行第 ${colOf(p) + 1} 列`;
}
