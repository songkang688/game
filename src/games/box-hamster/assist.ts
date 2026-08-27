// 推箱小仓鼠 · 1.2 辅助层:无限撤销、死局提示、难度标注、下一步提示、无尽生成保护。
//
// 全是纯函数,一个 DOM 都不碰。死局判定和「下一步」都以 solver.ts 为准 ——
// 宁可说「我也想不出来了」,也不能冤枉小朋友说「你完蛋了」。
import {
  ALL_DIRS,
  DIR_LABELS,
  cellAt,
  cloneState,
  isDeadCorner,
  isPlainRules,
  isSolved,
  stepCell,
  xOf,
  yOf,
  type Board,
  type Move,
  type Puzzle,
  type State,
} from "./logic";
import { solve, verifySolution } from "./solver";
import { buildEndless, type LevelDef } from "./levels";

// ---------------------------------------------------------------------------
// 一、撤销栈
// ---------------------------------------------------------------------------

/**
 * 撤销想退多少步就退多少步,只有一条内存保护:攒够这么多帧就把最早的丢掉。
 * 一关几百步已经远超小朋友的耐心,真到上限也只是退不回最开头,不影响重来。
 */
export const UNDO_CAP = 400;

export interface UndoStack {
  frames: State[];
  /** 因为超上限被丢掉了几帧 */
  dropped: number;
  cap: number;
}

export function newUndoStack(cap: number = UNDO_CAP): UndoStack {
  return { frames: [], dropped: 0, cap: Math.max(1, Math.round(cap)) };
}

/** 走一步之前把当前局面压进去 */
export function pushFrame(stack: UndoStack, state: State): UndoStack {
  stack.frames.push(cloneState(state));
  while (stack.frames.length > stack.cap) {
    stack.frames.shift();
    stack.dropped++;
  }
  return stack;
}

export function canUndo(stack: UndoStack): boolean {
  return stack.frames.length > 0;
}

/** 退一步;退不动返回 null */
export function undoFrame(stack: UndoStack): State | null {
  return stack.frames.pop() ?? null;
}

/** 重来:栈清空,丢帧计数也归零 */
export function resetStack(stack: UndoStack): UndoStack {
  stack.frames.length = 0;
  stack.dropped = 0;
  return stack;
}

// ---------------------------------------------------------------------------
// 二、死局判定
// ---------------------------------------------------------------------------

export type DeadReason = "corner" | "square" | "wall" | "solver";

/** 这一格推不动东西:墙,或者压着箱子 */
function blockedCell(b: Board, s: State, cell: number): boolean {
  if (cell < 0) return true;
  return b.wall[cell] || s.boxes.includes(cell);
}

/**
 * 2×2 全是墙或箱子、而且里头至少有一个箱子没归位 —— 这一坨谁也推不动了。
 * 冰面和传送门都救不了:箱子要动,紧邻的那一格必须是空的。
 */
export function deadSquare(b: Board, s: State): boolean {
  for (const box of s.boxes) {
    const bx = xOf(b, box);
    const by = yOf(b, box);
    for (const [dx, dy] of [
      [0, 0],
      [-1, 0],
      [0, -1],
      [-1, -1],
    ] as const) {
      const x = bx + dx;
      const y = by + dy;
      if (x < 0 || y < 0 || x + 1 >= b.w || y + 1 >= b.h) continue;
      const quad = [cellAt(b, x, y), cellAt(b, x + 1, y), cellAt(b, x, y + 1), cellAt(b, x + 1, y + 1)];
      if (!quad.every((c) => blockedCell(b, s, c))) continue;
      if (quad.some((c) => s.boxes.includes(c) && !b.target[c])) return true;
    }
  }
  return false;
}

/**
 * 贴死在一条墙边:箱子所在的这一整段走廊(两头都是墙)全程贴着同一面墙,
 * 而且这段里一个脚印都没有 —— 箱子只能在这条线上左右挪,永远踩不到脚印。
 *
 * 只在纯推箱关上用:冰面会改变落点,传送门更是能把箱子直接送走,
 * 那两种关一律交给求解器判,不靠这条规则。
 */
export function deadAgainstWall(b: Board, s: State): boolean {
  if (!isPlainRules(b)) return false;
  for (const box of s.boxes) {
    if (b.target[box]) continue;
    for (const axis of [0, 1] as const) {
      // axis 0:横着的走廊,看上下两面墙;axis 1:竖着的走廊,看左右两面墙
      const along: [number, number] = axis === 0 ? [1, 0] : [0, 1];
      const side: [number, number] = axis === 0 ? [0, 1] : [1, 0];
      for (const sign of [-1, 1] as const) {
        const cells: number[] = [box];
        let ok = true;
        for (const dir of [-1, 1] as const) {
          let x = xOf(b, box);
          let y = yOf(b, box);
          for (let guard = 0; guard < b.w * b.h; guard++) {
            x += along[0] * dir;
            y += along[1] * dir;
            if (x < 0 || y < 0 || x >= b.w || y >= b.h) break;
            const c = cellAt(b, x, y);
            if (b.wall[c]) break;
            cells.push(c);
          }
        }
        for (const c of cells) {
          const sx = xOf(b, c) + side[0] * sign;
          const sy = yOf(b, c) + side[1] * sign;
          const neighbour = sx < 0 || sy < 0 || sx >= b.w || sy >= b.h ? -1 : cellAt(b, sx, sy);
          if (neighbour >= 0 && !b.wall[neighbour]) {
            ok = false;
            break;
          }
          if (b.target[c]) {
            ok = false;
            break;
          }
        }
        if (ok) return true;
      }
    }
  }
  return false;
}

/** 只按规则看:这个局面死了吗?没死返回 null */
export function deadlockReason(b: Board, s: State): DeadReason | null {
  if (isSolved(b, s)) return null;
  for (const box of s.boxes) if (isDeadCorner(b, box)) return "corner";
  if (deadSquare(b, s)) return "square";
  if (deadAgainstWall(b, s)) return "wall";
  return null;
}

const DEAD_TIPS: Record<DeadReason, string> = {
  corner: "这个箱子推到墙角就出不来啦,按撤销退一步试试。",
  square: "几个箱子挤成一团谁也动不了了,撤销退两步换个顺序推。",
  wall: "箱子贴着墙走,这一条上没有脚印,撤销退回去换条路。",
  solver: "小仓鼠也算不出来了,按撤销退一步就好,一点都不亏。",
};

export function deadlockTip(reason: DeadReason): string {
  return DEAD_TIPS[reason];
}

export interface StuckReport {
  stuck: boolean;
  reason: DeadReason | null;
  /** 求解器撞上了节点上限:这种时候一律当「还有救」,不许吓唬小朋友 */
  capped: boolean;
  tip: string;
}

/**
 * 这个局面还救得回来吗。
 * 先过三条死局规则(快),再交给求解器复核(准)。
 * 求解器撞上限就当没事发生 —— 判不准的时候永远站在小朋友这边。
 */
export function stuckReport(p: Puzzle, s: State, opts: { nodeCap?: number; useSolver?: boolean } = {}): StuckReport {
  const byRule = deadlockReason(p, s);
  if (byRule) return { stuck: true, reason: byRule, capped: false, tip: deadlockTip(byRule) };
  if (opts.useSolver === false) return { stuck: false, reason: null, capped: false, tip: "" };

  const res = solve({ ...p, boxes: s.boxes.slice(), hamsters: s.hamsters.slice() }, { nodeCap: opts.nodeCap ?? 40_000 });
  if (res.solved) return { stuck: false, reason: null, capped: false, tip: "" };
  if (res.capped) return { stuck: false, reason: null, capped: true, tip: "" };
  return { stuck: true, reason: "solver", capped: false, tip: deadlockTip("solver") };
}

// ---------------------------------------------------------------------------
// 三、下一步提示
// ---------------------------------------------------------------------------

/** 每关只给一次「下一步」,用掉就不给三星了 */
export const HINTS_PER_LEVEL = 1;

export function hintsLeft(used: number): number {
  return Math.max(0, HINTS_PER_LEVEL - Math.max(0, Math.round(used)));
}

export function canUseHint(used: number): boolean {
  return hintsLeft(used) > 0;
}

export interface HintResult {
  move: Move | null;
  /** 从这里到通关还要走几步 */
  remaining: number;
  text: string;
}

/** 从当前局面重新求解,把解法的第一步交出去 */
export function nextHintMove(p: Puzzle, s: State, nodeCap = 60_000): HintResult {
  if (isSolved(p, s)) return { move: null, remaining: 0, text: "箱子已经全部归位啦!" };
  const res = solve({ ...p, boxes: s.boxes.slice(), hamsters: s.hamsters.slice() }, { nodeCap });
  if (!res.solved || res.moves.length === 0) {
    return { move: null, remaining: 0, text: "这个局面小仓鼠也想不出来了,按撤销退两步试试?" };
  }
  const first = res.moves[0];
  return {
    move: first,
    remaining: res.moves.length,
    text: `往${DIR_LABELS[first.dir]}走一格试试(照这条路还要 ${res.moves.length} 步)`,
  };
}

// ---------------------------------------------------------------------------
// 四、三星判定
// ---------------------------------------------------------------------------

/** 三星允许比参考解多走这么多步(和 1.1 的 parMoves 口径一致) */
export function threeStarLimit(def: Pick<LevelDef, "bestMoves" | "parMoves">): number {
  return def.parMoves;
}

/**
 * 三星要求:步数不超过参考解 + N 步,而且这一关没用过「下一步提示」。
 * **撤销随便用,一颗星都不扣** —— 撤销只在结算文案里露个面,鼓励小朋友大胆试。
 */
export function starsWithAssist(
  def: Pick<LevelDef, "bestMoves" | "parMoves" | "twoStarMoves">,
  moves: number,
  hintsUsed: number
): 1 | 2 | 3 {
  const base: 1 | 2 | 3 = moves <= def.parMoves ? 3 : moves <= def.twoStarMoves ? 2 : 1;
  if (hintsUsed > 0 && base === 3) return 2;
  return base;
}

/** 结算时多说一句:用了几次撤销、有没有看提示 */
export function assistSummary(undosUsed: number, hintsUsed: number): string {
  if (hintsUsed > 0 && undosUsed > 0) {
    return `这趟撤销了 ${undosUsed} 次、看了 1 次提示。撤销不扣星,下次自己想出来就是三星!`;
  }
  if (hintsUsed > 0) return "这趟看了 1 次提示,下次自己想出来就是三星!";
  if (undosUsed > 0) return `这趟撤销了 ${undosUsed} 次——撤销不扣星,敢试才推得快。`;
  return "全程没撤销也没看提示,想得真清楚!";
}

// ---------------------------------------------------------------------------
// 五、难度标注(只加标注,一格关卡数据都不改)
// ---------------------------------------------------------------------------

export interface DifficultyBand {
  stars: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** 这一档最少要推几下 */
  from: number;
}

/** 按 solver 求出来的最短推箱次数分档 */
export const DIFFICULTY_BANDS: DifficultyBand[] = [
  { stars: 1, label: "轻松", from: 0 },
  { stars: 2, label: "顺手", from: 6 },
  { stars: 3, label: "动脑", from: 10 },
  { stars: 4, label: "有点难", from: 15 },
  { stars: 5, label: "大挑战", from: 21 },
];

export function difficultyOf(pushes: number): DifficultyBand {
  let band = DIFFICULTY_BANDS[0];
  for (const b of DIFFICULTY_BANDS) if (pushes >= b.from) band = b;
  return band;
}

/** 一关的难度标注:拿它自己那条参考解的推箱次数算 */
export function difficultyOfLevel(def: Pick<LevelDef, "bestPushes">): DifficultyBand {
  return difficultyOf(def.bestPushes);
}

/** 地图上的小标签:★★☆☆☆ 顺手 */
export function difficultyBadge(def: Pick<LevelDef, "bestPushes">): string {
  const band = difficultyOfLevel(def);
  return `${"★".repeat(band.stars)}${"☆".repeat(5 - band.stars)} ${band.label}`;
}

/**
 * 章节层面的难度曲线:按关号平滑上升,一档一档来,不跳崖。
 * 这条是「设计意图」,用来对照实际标注有没有大起大落。
 */
export function plannedDifficulty(level: number, total = 188): 1 | 2 | 3 | 4 | 5 {
  const lv = Math.max(0, Math.min(total - 1, Math.round(level)));
  const step = total / 5;
  const n = Math.min(5, 1 + Math.floor(lv / step));
  return n as 1 | 2 | 3 | 4 | 5;
}

/** 一串难度标注是不是「单调不跳崖」:允许上下小波动,但不许一步跨两档 */
export function curveIsSmooth(stars: readonly number[]): boolean {
  for (let i = 1; i < stars.length; i++) {
    if (Math.abs(stars[i] - stars[i - 1]) > 1) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 六、无尽仓库:生成 + 求解验证 + 超时保护
// ---------------------------------------------------------------------------

/** 一仓最多花这么多毫秒去生成,超了就退回简单一点的仓,绝不卡住画面 */
export const ROOM_BUDGET_MS = 900;

export interface RoomRequest {
  round: number;
  budgetMs?: number;
  /** 注入时钟与生成器,单测才能把超时和失败都跑到 */
  now?: () => number;
  make?: (round: number) => LevelDef;
  verify?: (def: LevelDef) => boolean;
  maxTries?: number;
}

export interface RoomResult {
  def: LevelDef;
  /** 真正用上的是第几仓(退档时会比要的小) */
  round: number;
  tries: number;
  /** 有没有因为超时或验不过而退档 */
  fellBack: boolean;
  elapsedMs: number;
}

/** 默认验收:随关一起存的那条参考解真的能走通 */
export function roomIsPlayable(def: LevelDef): boolean {
  return def.boxes.length > 0 && verifySolution(def, def.reference);
}

/**
 * 造一仓无尽关卡:生成 → 用求解器给的参考解验一遍 → 过了才用。
 * 验不过或者时间超了就退一档重来,最后一定会交出一张能玩的(第 0 仓最简单,必然过)。
 */
export function makeEndlessRoom(req: RoomRequest): RoomResult {
  const now = req.now ?? (() => Date.now());
  const make = req.make ?? buildEndless;
  const verify = req.verify ?? roomIsPlayable;
  const budget = Math.max(1, req.budgetMs ?? ROOM_BUDGET_MS);
  const maxTries = Math.max(1, req.maxTries ?? 3);
  const started = now();

  let tries = 0;
  let want = Math.max(0, Math.round(req.round));
  let last: LevelDef | null = null;

  while (tries < maxTries) {
    tries++;
    const def = make(want);
    last = def;
    const elapsed = now() - started;
    if (verify(def) && elapsed <= budget) {
      return { def, round: want, tries, fellBack: want !== Math.max(0, Math.round(req.round)), elapsedMs: elapsed };
    }
    // 超时或者验不过:退一档再来,难度降下来生成也会快
    if (want === 0) break;
    want = Math.max(0, want - Math.max(1, Math.ceil(want / 2)));
  }

  const def = last && verify(last) ? last : make(0);
  return {
    def,
    round: last && verify(last) ? want : 0,
    tries: tries + (last && verify(last) ? 0 : 1),
    fellBack: true,
    elapsedMs: now() - started,
  };
}

// ---------------------------------------------------------------------------
// 七、推箱动画时序
// ---------------------------------------------------------------------------

/** 一格移动的时长:走路快一点,推箱慢一点,看得清箱子是被推过去的 */
export const WALK_MS = 120;
export const PUSH_MS = 160;
/** 撤销时反着播,速度快一倍 */
export const UNDO_SPEED = 2;

/** 这一步该用多长时间(单位毫秒);关了动效就压到一帧 */
export function moveDuration(kind: "walk" | "push", reducedMotion: boolean, undoing = false): number {
  if (reducedMotion) return 16;
  const base = kind === "push" ? PUSH_MS : WALK_MS;
  return undoing ? Math.round(base / UNDO_SPEED) : base;
}

/** 仓鼠转向:朝哪边就转多少度,不许瞬间换脸 */
export function facingAngle(dir: 0 | 1 | 2 | 3): number {
  return [0, 90, 180, 270][dir];
}

/** 走一步之后仓鼠面朝哪个方向的中文说法(无障碍播报用) */
export function facingLabel(dir: 0 | 1 | 2 | 3): string {
  return DIR_LABELS[dir];
}

// ---------------------------------------------------------------------------
// 八、棋盘要占多宽:窄屏上一列都不许被切掉
// ---------------------------------------------------------------------------

/** 格子之间的缝,和 CSS 里 `.bh-grid` 的 `gap` 是同一个数 */
export const CELL_GAP = 2;
/** 宽屏上格子最大就这么大,再大反而一眼看不全整张棋盘 */
export const CELL_MAX = 42;
/**
 * 格子最小边长。
 *
 * 棋盘格子只负责「看」——走位靠方向键和触屏方向盘，没有一个格子是点得动的，
 * 所以这里不受 44px 触摸下限管；18px 上 26px 的箱子表情还认得出，
 * 而 360px 上最宽的 13 列棋盘只需要 23px 就摆得下，实际远用不到这个下限。
 */
export const CELL_MIN = 18;

/** cols 列、每格 cell 像素的棋盘一共要占多宽 */
export function boardWidth(cols: number, cell: number, gap: number = CELL_GAP): number {
  const n = Math.max(1, Math.round(cols));
  return n * cell + (n - 1) * gap;
}

/**
 * 在 avail 像素宽的地方摆 cols 列，每格该多大。
 *
 * 改之前格子边长是媒体查询写死的（42 / 34 / 28），跟列数没关系：
 * 13 列 × 34px = 466px，而 360px 手机留给棋盘的只有 332px，
 * 右边 4 列直接被 `.game-stage` 的 `overflow:hidden` 吃掉——看不见也点不到。
 * 现在按「有多少地方」倒着算格子边长，夹在上下限之间取整。
 */
export function fitCell(cols: number, avail: number, gap: number = CELL_GAP): number {
  const n = Math.max(1, Math.round(cols));
  if (!Number.isFinite(avail) || avail <= 0) return CELL_MAX;
  const raw = Math.floor((avail - (n - 1) * gap) / n);
  return Math.max(CELL_MIN, Math.min(CELL_MAX, raw));
}

/** 四方向里哪些是这一步走得动的(触屏方向键按它变灰) */
export function usableDirs(p: Puzzle, s: State, who: number): boolean[] {
  return ALL_DIRS.map((dir) => {
    const from = s.hamsters[who];
    if (from === undefined) return false;
    const next = stepCell(p, from, dir);
    return next >= 0 && !p.wall[next];
  });
}
