/**
 * 军旗对决 · 布阵。
 *
 * 三条硬规矩（`validateSetup` 逐条检查）：
 *  1. 军旗必须坐在两个大本营之一；
 *  2. 地雷只能摆在自己最后两行；
 *  3. 炸弹不能摆在第一行（也就是离对方最近的那一行前沿）。
 *
 * 还有一条是棋盘本身保证的：每边非行营格正好 25 个，25 枚棋子摆满，
 * **行营开局天然放不下子**（`CAMP_START_EMPTY`）。
 */
import {
  BACK_TWO_ROWS,
  CAMP,
  CELLS,
  FRONT_ROW,
  HQ,
  cellsOf,
  colOf,
  halfOf,
  idx,
  inCamp,
  isRail,
  placeableOf,
  rowOf,
  type Pos,
  type Side,
} from "./board";
import { mulberry32, shuffled } from "./rng";
import { ARMY, ARMY_SIZE, KINDS, LABEL, makeState, type Cell, type GameState, type Kind } from "./rules";

/** 本款按常见规则来：行营里开局不放子 */
export const CAMP_START_EMPTY = true;

export interface SetupPlacement {
  side: Side;
  /** 60 长的整盘数组，只填自己半边 */
  cells: (Kind | null)[];
}

export interface SetupCheck {
  ok: boolean;
  errors: string[];
}

/** 空的一整盘 */
export function emptyKinds(): (Kind | null)[] {
  return new Array<Kind | null>(CELLS).fill(null);
}

export function validateSetup(placement: SetupPlacement): SetupCheck {
  const { side, cells } = placement;
  const errors: string[] = [];
  if (cells.length !== CELLS) {
    return { ok: false, errors: [`棋盘应该是 ${CELLS} 格，收到 ${cells.length} 格。`] };
  }

  const counts = new Map<Kind, number>();
  for (let p = 0; p < CELLS; p++) {
    const k = cells[p];
    if (!k) continue;
    if (halfOf(p) !== side) {
      errors.push("只能在自己这半边摆子。");
      continue;
    }
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (CAMP_START_EMPTY && inCamp(p)) errors.push(`行营里开局不能放子（${LABEL[k]}）。`);
    if (k === "dilei" && !BACK_TWO_ROWS[side].includes(rowOf(p))) {
      errors.push("地雷只能摆在自己最后两行。");
    }
    if (k === "zhadan" && rowOf(p) === FRONT_ROW[side]) {
      errors.push("炸弹不能摆在第一行。");
    }
    if (k === "junqi" && !HQ[side].includes(p)) {
      errors.push("军旗必须坐在大本营里。");
    }
  }

  let total = 0;
  for (const k of KINDS) {
    const got = counts.get(k) ?? 0;
    total += got;
    if (got !== ARMY[k]) errors.push(`${LABEL[k]}应该有 ${ARMY[k]} 枚，摆了 ${got} 枚。`);
  }
  if (total !== ARMY_SIZE) errors.push(`一共应该摆 ${ARMY_SIZE} 枚，摆了 ${total} 枚。`);

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

/** AI 布阵的讲究程度：越高越像个懂行的人摆的 */
export type SetupSkill = 0 | 1 | 2;

/**
 * 随机布阵（合法性由构造保证，再过一遍 validateSetup 也一定过）。
 *
 * skill 0：除了三条硬规矩以外全随机；
 * skill 1：军旗前面压一枚地雷，另一个大本营也塞一枚地雷；
 * skill 2：再把大子往铁路边上放，工兵散开，炸弹留在中间待命。
 */
export function randomSetup(side: Side, seed: number, skill: SetupSkill = 1): (Kind | null)[] {
  const rand = mulberry32((seed ^ (side === "duo" ? 0x51ed : 0x9a3c)) >>> 0);
  const cells = emptyKinds();
  const free = new Set<Pos>(placeableOf(side));

  const put = (p: Pos, k: Kind): void => {
    cells[p] = k;
    free.delete(p);
  };
  const take = (pool: Pos[]): Pos => pool[Math.floor(rand() * pool.length)];

  // 军旗：两个大本营挑一个
  const hqs = HQ[side].slice();
  const flagAt = hqs[Math.floor(rand() * hqs.length)];
  put(flagAt, "junqi");
  const otherHQ = hqs.find((p) => p !== flagAt) as Pos;

  // 地雷：只在最后两行
  const mineSpots = [...free].filter((p) => BACK_TWO_ROWS[side].includes(rowOf(p)));
  const guard = idx(
    side === "star" ? 1 : 10,
    colOf(flagAt)
  );
  const mines: Pos[] = [];
  if (skill >= 1) {
    if (free.has(guard)) mines.push(guard);
    if (free.has(otherHQ)) mines.push(otherHQ);
  }
  for (const p of shuffled(mineSpots, rand)) {
    if (mines.length >= ARMY.dilei) break;
    if (!free.has(p) || mines.includes(p)) continue;
    mines.push(p);
  }
  for (const p of mines.slice(0, ARMY.dilei)) put(p, "dilei");

  // 炸弹：不能放第一行
  const bombSpots = shuffled(
    [...free].filter((p) => rowOf(p) !== FRONT_ROW[side]),
    rand
  ).sort((a, b) => {
    if (skill < 2) return 0;
    const mid = side === "star" ? 3 : 8;
    return Math.abs(rowOf(a) - mid) - Math.abs(rowOf(b) - mid);
  });
  for (let i = 0; i < ARMY.zhadan; i++) put(bombSpots[i], "zhadan");

  // 剩下的按号数从大到小挑位置
  const rest: Kind[] = [];
  for (const k of KINDS) {
    if (k === "junqi" || k === "dilei" || k === "zhadan") continue;
    for (let i = 0; i < ARMY[k]; i++) rest.push(k);
  }
  const spots = shuffled([...free], rand);
  if (skill >= 2) {
    // 大子靠铁路，跑得快；工兵留在后面，方便顺着铁路去挖雷
    spots.sort((a, b) => Number(isRail(b)) - Number(isRail(a)));
    rest.sort((a, b) => {
      const w = (k: Kind): number => (k === "gongbing" ? -1 : ARMY_SIZE - KINDS.indexOf(k));
      return w(b) - w(a);
    });
  }
  rest.forEach((k, i) => put(spots[i], k));

  return cells;
}

/** 把一份布阵变成真的棋子（带 id，暗棋推理靠 id 认人） */
export function piecesFrom(kinds: readonly (Kind | null)[], side: Side, firstId: number): Cell[] {
  const out: Cell[] = new Array<Cell>(CELLS).fill(null);
  let id = firstId;
  for (let p = 0; p < CELLS; p++) {
    const k = kinds[p];
    if (!k) continue;
    out[p] = { id: id++, side, kind: k };
  }
  return out;
}

export interface NewGameOptions {
  duoSkill?: SetupSkill;
  starSkill?: SetupSkill;
  turn?: Side;
}

/** 开一盘新棋：两边各自布好阵，鸭梨先走 */
export function newGame(seed: number, opts: NewGameOptions = {}): GameState {
  const duo = piecesFrom(randomSetup("duo", seed, opts.duoSkill ?? 1), "duo", 1);
  const star = piecesFrom(randomSetup("star", seed + 977, opts.starSkill ?? 1), "star", 200);
  const cells: Cell[] = new Array<Cell>(CELLS).fill(null);
  for (let p = 0; p < CELLS; p++) cells[p] = duo[p] ?? star[p];
  return makeState(cells, { turn: opts.turn ?? "duo" });
}

/** 单测与调试用：把整盘还原成 kinds 数组 */
export function kindsOf(cells: readonly Cell[], side: Side): (Kind | null)[] {
  const out = emptyKinds();
  for (let p = 0; p < cells.length; p++) {
    const c = cells[p];
    if (c && c.side === side) out[p] = c.kind;
  }
  return out;
}

/** 这一边开局能摆子的格子数（应当正好 25） */
export function placeableCount(side: Side): number {
  return placeableOf(side).length;
}

/** 行营列表（guide 与视图都要用） */
export function campsOf(side: Side): readonly Pos[] {
  return CAMP[side];
}

/** 这一边全部格子（视图画半边底色用） */
export function halfCells(side: Side): Pos[] {
  return cellsOf(side);
}
