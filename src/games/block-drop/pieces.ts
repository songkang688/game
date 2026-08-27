/**
 * 方块叠叠乐 · 七种小方块的形状表(纯数据 + 纯函数)。
 *
 * 坐标约定:x 向右、y 向下,格子坐标是相对「外接方框左上角」的偏移。
 * 外接方框对旋转很重要:三格宽的五种块用 3×3,长条用 4×4,方块用 2×2,
 * 这样按方框转 90° 出来的四个旋转态就和通用旋转规范对得上。
 */

export type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export const PIECE_IDS: PieceId[] = ["I", "O", "T", "S", "Z", "J", "L"];

/** 旋转态:0 出生态,1 顺时针一次,2 倒过来,3 逆时针一次 */
export type Rot = 0 | 1 | 2 | 3;

export const ROTS: Rot[] = [0, 1, 2, 3];

export interface Cell {
  x: number;
  y: number;
}

/** 出生态的方框图,1 表示这一格有砖 */
const SPAWN_SHAPES: Record<PieceId, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ]
};

/** 把方框顺时针转 90° */
export function rotateMatrix(m: number[][]): number[][] {
  const n = m.length;
  const out: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) row.push(m[n - 1 - c][r]);
    out.push(row);
  }
  return out;
}

function cellsOf(m: number[][]): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x]) out.push({ x, y });
    }
  }
  return out;
}

function buildShapes(): Record<PieceId, number[][][]> {
  const out = {} as Record<PieceId, number[][][]>;
  for (const id of PIECE_IDS) {
    const states: number[][][] = [SPAWN_SHAPES[id]];
    for (let i = 1; i < 4; i++) states.push(rotateMatrix(states[i - 1]));
    out[id] = states;
  }
  return out;
}

/** 每种块四个旋转态的方框图 */
export const SHAPES: Record<PieceId, number[][][]> = buildShapes();

function buildCells(): Record<PieceId, Cell[][]> {
  const out = {} as Record<PieceId, Cell[][]>;
  for (const id of PIECE_IDS) out[id] = SHAPES[id].map(cellsOf);
  return out;
}

/** 每种块四个旋转态的格子坐标 */
export const PIECES: Record<PieceId, Cell[][]> = buildCells();

/** 外接方框边长 */
export const BOX_SIZE: Record<PieceId, number> = {
  I: 4,
  O: 2,
  T: 3,
  S: 3,
  Z: 3,
  J: 3,
  L: 3
};

/** 粉彩七色:每种块一个颜色,不用任何官方配色的名字 */
export const PIECE_COLORS: Record<PieceId, string> = {
  I: "#A8DDE8",
  O: "#F8DFA8",
  T: "#D9BFF0",
  S: "#BFE7B0",
  Z: "#F7B8C4",
  J: "#AFC6F0",
  L: "#F5C79A"
};

/** 色盲友好的形状角标,可以在设置里打开 */
export const PIECE_MARKS: Record<PieceId, string> = {
  I: "一",
  O: "口",
  T: "凸",
  S: "之",
  Z: "乙",
  J: "「",
  L: "」"
};

/** 给孩子看的块名,不用外文字母以外的任何专有名 */
export const PIECE_NAMES: Record<PieceId, string> = {
  I: "长条",
  O: "小方",
  T: "小凸",
  S: "左折",
  Z: "右折",
  J: "左钩",
  L: "右钩"
};

/** 出生时方框左上角落在第几列(10 列场地居中) */
export function spawnX(id: PieceId, cols = 10): number {
  return Math.floor((cols - BOX_SIZE[id]) / 2);
}

/** 取某个旋转态的格子 */
export function cellsFor(id: PieceId, rot: Rot): Cell[] {
  return PIECES[id][((rot % 4) + 4) % 4];
}

/** 顺时针 / 逆时针转一格 */
export function rotStep(rot: Rot, dir: 1 | -1): Rot {
  return (((rot + dir) % 4) + 4) % 4 as Rot;
}

/**
 * 七个一袋的随机:一袋里七种块各出现一次,顺序打乱。
 * 这样既有随机感,又不会连着好几个都不出长条。
 */
export function nextBag(rand: () => number): PieceId[] {
  const bag = [...PIECE_IDS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1)) % (i + 1);
    const t = bag[i];
    bag[i] = bag[j];
    bag[j] = t;
  }
  return bag;
}

/** 固定 seed 的随机源,保证同一关每次的出块顺序一样 */
export function rng(seed: number): () => number {
  let a = (Math.round(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 出块队列:内部按袋补货,外面只管取下一个、看后面几个。
 */
export class PieceQueue {
  private buf: PieceId[] = [];

  /**
   * set 只在入门章用:那几关故意只出简单的几种块。
   * 不传就是标准的七个一袋。
   */
  constructor(
    private readonly rand: () => number,
    private readonly set: readonly PieceId[] = PIECE_IDS
  ) {
    this.refill();
  }

  private refill(): void {
    while (this.buf.length <= 7) {
      if (this.set.length >= PIECE_IDS.length) {
        this.buf.push(...nextBag(this.rand));
      } else {
        const small = [...this.set];
        for (let i = small.length - 1; i > 0; i--) {
          const j = Math.floor(this.rand() * (i + 1)) % (i + 1);
          const t = small[i];
          small[i] = small[j];
          small[j] = t;
        }
        this.buf.push(...small);
      }
    }
  }

  /** 取出下一个块 */
  take(): PieceId {
    this.refill();
    return this.buf.shift() as PieceId;
  }

  /** 预览后面 n 个 */
  peek(n: number): PieceId[] {
    this.refill();
    return this.buf.slice(0, Math.max(0, Math.round(n)));
  }
}
