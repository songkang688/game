/**
 * 方块叠叠乐 · 超级旋转系统(踢墙)。
 *
 * 旋转的时候先原地试,不行就按表里的偏移依次挪一挪再试,
 * 五组都塞不进去这次旋转就作废。数值取自公开的通用旋转规范,
 * 只用数值,不用任何商业名称。
 *
 * 表里的 y 是「向上为正」的写法,套到我们向下为正的场地上要取负号,
 * 这一步统一在 kicksFor 里做完,外面拿到的偏移可以直接加。
 */
import { BOX_SIZE, cellsFor, rotStep, type PieceId, type Rot } from "./pieces";

export interface Kick {
  dx: number;
  dy: number;
}

/** 表的键写成 "0>1" 这样,表示从哪个旋转态转到哪个(不含原地不转) */
export type KickKey =
  | "0>1"
  | "1>0"
  | "1>2"
  | "2>1"
  | "2>3"
  | "3>2"
  | "3>0"
  | "0>3"
  | "0>2"
  | "2>0"
  | "1>3"
  | "3>1";

/** 五种三格宽方块共用的一张表(y 向上为正) */
export const KICKS_JLSTZ: Record<KickKey, [number, number][]> = {
  "0>1": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2]
  ],
  "1>0": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2]
  ],
  "1>2": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2]
  ],
  "2>1": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2]
  ],
  "2>3": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2]
  ],
  "3>2": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2]
  ],
  "3>0": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2]
  ],
  "0>3": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2]
  ],
  // 转 180° 不在通用规范里,这里只允许原地转,不给踢墙
  "0>2": [[0, 0]],
  "2>0": [[0, 0]],
  "1>3": [[0, 0]],
  "3>1": [[0, 0]]
};

/** 长条自己一套表(y 向上为正) */
export const KICKS_I: Record<KickKey, [number, number][]> = {
  "0>1": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2]
  ],
  "1>0": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2]
  ],
  "1>2": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1]
  ],
  "2>1": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1]
  ],
  "2>3": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2]
  ],
  "3>2": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2]
  ],
  "3>0": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1]
  ],
  "0>3": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1]
  ],
  "0>2": [[0, 0]],
  "2>0": [[0, 0]],
  "1>3": [[0, 0]],
  "3>1": [[0, 0]]
};

/**
 * 取某次旋转要试的五组偏移,已经换成「y 向下为正」的场地坐标。
 * 小方块不会转,给一组原地偏移意思一下。
 */
export function kicksFor(id: PieceId, from: Rot, to: Rot): Kick[] {
  if (id === "O") return [{ dx: 0, dy: 0 }];
  const table = id === "I" ? KICKS_I : KICKS_JLSTZ;
  const raw = table[`${from}>${to}` as KickKey] ?? [[0, 0]];
  return raw.map(([dx, dy]) => ({ dx, dy: -dy }));
}

/** 一次旋转的结果 */
export interface RotateResult {
  x: number;
  y: number;
  rot: Rot;
  /** 用的是第几组偏移,0 表示原地就转成了 */
  kickIndex: number;
  /** 有没有靠踢墙才转进去 */
  kicked: boolean;
}

export type CollideFn = (cells: { x: number; y: number }[], x: number, y: number) => boolean;

/**
 * 试着转一下:五组偏移依次试,第一组塞得进去就落位,全失败返回 null(原地不动)。
 */
export function tryRotate(
  id: PieceId,
  rot: Rot,
  x: number,
  y: number,
  dir: 1 | -1,
  collides: CollideFn
): RotateResult | null {
  const to = rotStep(rot, dir);
  const cells = cellsFor(id, to);
  const kicks = kicksFor(id, rot, to);
  for (let i = 0; i < kicks.length; i++) {
    const nx = x + kicks[i].dx;
    const ny = y + kicks[i].dy;
    if (!collides(cells, nx, ny)) {
      return { x: nx, y: ny, rot: to, kickIndex: i, kicked: i > 0 };
    }
  }
  return null;
}

/** 方框边长再导出一次,画预览的时候要用 */
export { BOX_SIZE };
