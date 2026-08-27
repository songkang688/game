/**
 * 朵星台球 · 美式八球简化规则（全部纯函数）。
 *
 * 犯规表逐条对应 PLAN.md 里那张表：
 *  1 开球没过中线 / 没碰球堆 → 犯规重摆
 *  2 开球把黑星球打进 → 不判胜负，重摆
 *  3 空杆 → 犯规，对方自由球
 *  4 第一颗碰到的不是己组球 → 犯规，对方自由球
 *  5 己组没清完先碰黑星球 → 犯规，对方自由球
 *  6 母球落袋 → 犯规，对方自由球
 *  7 己组没清完却把黑星球打进 → 判负
 *  8 黑星球与母球同一杆落袋 → 判负
 *  9 指定袋模式黑星球进错袋 → 判负
 * 10 连续 3 次犯规 → 判负（可开关）
 * 11 己组清完后合法把黑星球打进 → 胜
 * 12 己组最后一颗与黑星球同杆进袋且无犯规 → 胜
 * 13 打进对方的球不算犯规，球算对方的
 */
import {
  POCKETS,
  TABLE,
  type Ball,
  type BallKind,
  type ShotResult,
  type TableSpec,
  type Vec,
  dist,
  pocketed,
  spotFree,
} from "./physics";

/** 玩家的分组：暖色组 / 冷色组 */
export type Group = "warm" | "cool";

export const GROUP_LABEL: Record<Group, string> = {
  warm: "暖色组",
  cool: "冷色组",
};

export const GROUP_EMOJI: Record<Group, string> = {
  warm: "🌸",
  cool: "❄️",
};

export const POCKET_LABEL: readonly string[] = [
  "左上袋",
  "上中袋",
  "右上袋",
  "左下袋",
  "下中袋",
  "右下袋",
];

/**
 * 打进对方的球要不要给续杆机会。
 * 规格写死：不影响自己继续与否——能不能续杆只看有没有进己组球，
 * 对方的球只是算到对方账上。
 */
export const OPPONENT_POT_KEEPS_TURN = false;

/** 连续几次犯规判负 */
export const FOUL_LIMIT = 3;

export type FoulCode =
  | "none"
  | "cue-potted"
  | "no-contact"
  | "wrong-first"
  | "black-first-early"
  | "break-short";

export const FOUL_TEXT: Record<FoulCode, string> = {
  none: "",
  "cue-potted": "母球掉袋啦，把杆交给对方，对方可以自由摆球。",
  "no-contact": "这一杆一颗球都没碰到，算一次犯规，换对方出杆。",
  "wrong-first": "母球先碰到的不是自己那一组，算一次犯规，换对方出杆。",
  "black-first-early": "自己那一组还没清完，先碰黑星球算犯规，换对方出杆。",
  "break-short": "开球要让母球过中线并撞散球堆，重新摆一次再来。",
};

/** 一杆的判定要用到的最小输入（视图与电脑球手都靠它） */
export interface ShotFacts {
  firstHit: BallKind | null;
  potted: readonly BallKind[];
  cueCrossedCenter: boolean;
}

/**
 * 犯规判定（规格第六节 `foulReason(firstHit, pocketedList, group)`）。
 * group 传 null 表示台面还开放（还没分组），这时候只有黑星球不能先碰。
 * ownCleared 为真表示己组已清完，合法目标变成黑星球。
 */
export function foulReason(
  firstHit: BallKind | null,
  pottedList: readonly BallKind[],
  group: Group | null,
  opts: { ownCleared?: boolean } = {}
): FoulCode {
  if (pottedList.includes("cue")) return "cue-potted";
  if (firstHit === null) return "no-contact";
  const ownCleared = opts.ownCleared === true;
  if (group === null) {
    // 开放局面：暖色冷色随便先碰，就是不能先碰黑星球
    return firstHit === "black" ? "black-first-early" : "none";
  }
  const legalTarget: BallKind = ownCleared ? "black" : group;
  if (firstHit === legalTarget) return "none";
  if (firstHit === "black" && !ownCleared) return "black-first-early";
  return "wrong-first";
}

// ---------------------------------------------------------------------------
// 开球与分组
// ---------------------------------------------------------------------------

export interface BreakVerdict {
  /** 要不要重摆 */
  rerack: boolean;
  /** 这一杆算不算犯规 */
  foul: boolean;
  /** 台面还开放着（没分组） */
  open: boolean;
  /** 开球方拿到的分组；还没分就是 null */
  group: Group | null;
  reason: string;
}

/**
 * 开球判定（规格第六节 `assignGroups(breakResult)`）：
 *  - 开球进黑星球 → 重摆，不判胜负；
 *  - 母球没过中线或者空杆 → 犯规 + 重摆；
 *  - 第一颗合法落袋的非黑星球决定分组；
 *  - 什么都没进 → 台面继续开放。
 */
export function assignGroups(res: ShotFacts): BreakVerdict {
  if (res.potted.includes("black")) {
    return { rerack: true, foul: false, open: true, group: null, reason: "开球就把黑星球送进袋啦，这一局重新摆过，不算胜负。" };
  }
  if (!res.cueCrossedCenter || res.firstHit === null) {
    return { rerack: true, foul: true, open: true, group: null, reason: FOUL_TEXT["break-short"] };
  }
  if (res.potted.includes("cue")) {
    // 开球母球落袋：犯规交杆，台面仍然开放
    return { rerack: false, foul: true, open: true, group: null, reason: FOUL_TEXT["cue-potted"] };
  }
  const first = res.potted.find((k) => k === "warm" || k === "cool");
  if (first === "warm" || first === "cool") {
    return {
      rerack: false,
      foul: false,
      open: false,
      group: first,
      reason: `开球进了${GROUP_LABEL[first]}的球，这一局你打${GROUP_LABEL[first]}。`,
    };
  }
  return { rerack: false, foul: false, open: true, group: null, reason: "开球把球堆撞开了，台面还开放着，进了谁就打谁那一组。" };
}

// ---------------------------------------------------------------------------
// 黑星球胜负
// ---------------------------------------------------------------------------

export interface EightState {
  /** 出杆方这一局打哪一组；开放局面传 null */
  group: Group | null;
  /** 出杆前己组还剩几颗 */
  ownRemaining: number;
  /** 要不要指定袋 */
  requireCall: boolean;
  /** 指定的袋号（-1 或 null 表示没指定） */
  calledPocket: number | null;
}

export interface EightEvents {
  potted: readonly { kind: BallKind; pocket: number }[];
  foul: FoulCode;
}

/**
 * 黑星球落袋后的胜负（规格第六节 `eightBallOutcome(state, events)`）。
 * 没有落袋黑星球就返回 null（这一杆不涉及胜负）。
 */
export function eightBallOutcome(state: EightState, ev: EightEvents): "win" | "lose" | null {
  const black = ev.potted.find((p) => p.kind === "black");
  if (!black) return null;
  if (ev.potted.some((p) => p.kind === "cue")) return "lose"; // 黑星球与母球同进
  const ownPotted = state.group ? ev.potted.filter((p) => p.kind === state.group).length : 0;
  const remainAfter = state.ownRemaining - ownPotted;
  if (state.group === null || remainAfter > 0) return "lose"; // 己组没清完
  if (ev.foul !== "none") return "lose";
  if (state.requireCall && state.calledPocket !== null && state.calledPocket >= 0) {
    if (black.pocket !== state.calledPocket) return "lose"; // 进错袋
  }
  return "win";
}

// ---------------------------------------------------------------------------
// 自由球
// ---------------------------------------------------------------------------

/**
 * 自由球摆位（规格第六节 `placeCueBall(state, pos)`）：
 * 先把点压进台面，再往外螺旋找一个不压袋口、不和别的球重叠的位置。
 */
export function placeCueBall(
  balls: readonly Ball[],
  pos: Vec,
  table: TableSpec = TABLE
): { ok: boolean; pos: Vec } {
  const others = balls.filter((b) => b.kind !== "cue" && !b.potted);
  const clampIn = (p: Vec): Vec => ({
    x: Math.min(Math.max(p.x, table.r), table.w - table.r),
    y: Math.min(Math.max(p.y, table.r), table.h - table.r),
  });
  const start = clampIn(pos);
  if (spotFree(start, others, table)) return { ok: true, pos: start };

  for (let ring = 1; ring <= 40; ring++) {
    const rad = ring * table.r * 0.8;
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      const cand = clampIn({ x: start.x + Math.cos(ang) * rad, y: start.y + Math.sin(ang) * rad });
      if (spotFree(cand, others, table)) return { ok: false, pos: cand };
    }
  }
  return { ok: false, pos: start };
}

/** 母球在开球区（左边四分之一）的默认位置 */
export function breakSpot(table: TableSpec = TABLE): Vec {
  return { x: table.w * 0.22, y: table.h / 2 };
}

// ---------------------------------------------------------------------------
// 摆球
// ---------------------------------------------------------------------------

/**
 * 三角形摆球：暖色 7 颗、冷色 7 颗、黑星球 1 颗，黑星球固定在第三排正中。
 * seed 决定同色球之间的排布，保证同一局每次摆得一样。
 */
export function rackBalls(seed = 1, table: TableSpec = TABLE): Ball[] {
  const apex = { x: table.w * 0.68, y: table.h / 2 };
  const gap = table.r * 2 + 0.12;
  const slots: Vec[] = [];
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      slots.push({
        x: apex.x + row * gap * 0.866,
        y: apex.y + (i - row / 2) * gap,
      });
    }
  }
  // 第三排正中是黑星球（15 颗球里的第 5 号槽位）
  const blackSlot = 4;
  const order: BallKind[] = [];
  let warm = 7;
  let cool = 7;
  let a = seed >>> 0;
  const rnd = (): number => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  for (let i = 0; i < slots.length; i++) {
    if (i === blackSlot) {
      order.push("black");
      continue;
    }
    // 角上两颗按惯例一暖一冷，其余随 seed 交错
    const takeWarm = warm > 0 && (cool === 0 || rnd() < warm / (warm + cool));
    if (takeWarm) {
      warm--;
      order.push("warm");
    } else {
      cool--;
      order.push("cool");
    }
  }

  const out: Ball[] = [
    { id: 0, kind: "cue", ...breakSpot(table), vx: 0, vy: 0, spin: 0, potted: false, pocket: -1 },
  ];
  for (let i = 0; i < slots.length; i++) {
    out.push({
      id: i + 1,
      kind: order[i],
      x: slots[i].x,
      y: slots[i].y,
      vx: 0,
      vy: 0,
      spin: 0,
      potted: false,
      pocket: -1,
    });
  }
  return out;
}

/** 台面上某一组还剩几颗 */
export function remainingOf(balls: readonly Ball[], group: Group): number {
  return balls.filter((b) => b.kind === group && !b.potted).length;
}

// ---------------------------------------------------------------------------
// 一局的状态机
// ---------------------------------------------------------------------------

export interface MatchState {
  balls: Ball[];
  /** 该谁出杆：0 = 朵朵 / 玩家，1 = 星星 / 电脑 */
  turn: 0 | 1;
  /** 两人的分组；台面开放时都是 null */
  groups: [Group | null, Group | null];
  open: boolean;
  phase: "break" | "play" | "over";
  fouls: [number, number];
  /** 出杆方拿到了自由球 */
  freeBall: boolean;
  /** 黑星球要不要指定袋 */
  requireCall: boolean;
  calledPocket: number | null;
  /** 连续三次犯规判负开关 */
  threeFoulLoss: boolean;
  winner: -1 | 0 | 1;
  message: string;
  /** 这一杆要求重摆 */
  rerack: boolean;
}

export interface MatchOptions {
  seed?: number;
  requireCall?: boolean;
  threeFoulLoss?: boolean;
  first?: 0 | 1;
}

export function createMatch(opts: MatchOptions = {}): MatchState {
  return {
    balls: rackBalls(opts.seed ?? 1),
    turn: opts.first ?? 0,
    groups: [null, null],
    open: true,
    phase: "break",
    fouls: [0, 0],
    freeBall: false,
    requireCall: opts.requireCall ?? true,
    calledPocket: null,
    threeFoulLoss: opts.threeFoulLoss ?? true,
    winner: -1,
    message: "开球啦：母球要过中线，还要真的撞到球堆。",
    rerack: false,
  };
}

function other(turn: 0 | 1): 0 | 1 {
  return turn === 0 ? 1 : 0;
}

/**
 * 一杆打完之后把整局往前推一格：判犯规、判分组、判胜负、决定该谁出杆。
 * 纯函数：不改传进来的 state，返回新的一份。
 */
export function resolveShot(m: MatchState, res: ShotResult): MatchState {
  const next: MatchState = {
    ...m,
    balls: res.balls.map((b) => ({ ...b })),
    groups: [m.groups[0], m.groups[1]],
    fouls: [m.fouls[0], m.fouls[1]],
    freeBall: false,
    rerack: false,
    calledPocket: null,
  };
  const shooter = m.turn;
  const rival = other(shooter);
  const pottedKinds = res.potted.map((p) => p.kind);

  // ---- 开球 ----
  if (m.phase === "break") {
    const verdict = assignGroups({
      firstHit: res.firstHit,
      potted: pottedKinds,
      cueCrossedCenter: res.cueCrossedCenter,
    });
    if (verdict.rerack) {
      next.balls = rackBalls(((m.balls.length * 7 + m.fouls[0] + m.fouls[1] + 3) % 97) + 1);
      next.phase = "break";
      next.open = true;
      next.groups = [null, null];
      next.rerack = true;
      next.message = verdict.reason;
      if (verdict.foul) {
        next.fouls[shooter] = m.fouls[shooter] + 1;
        next.turn = rival;
      }
      return next;
    }
    next.phase = "play";
    if (verdict.group) {
      next.groups[shooter] = verdict.group;
      next.groups[rival] = verdict.group === "warm" ? "cool" : "warm";
      next.open = false;
    } else {
      next.open = true;
    }
    if (verdict.foul) {
      next.fouls[shooter] = m.fouls[shooter] + 1;
      next.turn = rival;
      next.freeBall = true;
      next.message = verdict.reason;
      return maybeThreeFoul(next, shooter, rival);
    }
    next.fouls[shooter] = 0;
    const gotOwn = verdict.group !== null;
    next.turn = gotOwn ? shooter : rival;
    next.message = verdict.reason;
    return next;
  }

  // ---- 正常回合 ----
  const group = m.groups[shooter];
  const ownRemainingBefore = group ? remainingOf(m.balls, group) : 0;
  const ownCleared = group !== null && ownRemainingBefore === 0;
  const foul = foulReason(res.firstHit, pottedKinds, group, { ownCleared });

  const outcome = eightBallOutcome(
    {
      group,
      ownRemaining: ownRemainingBefore,
      requireCall: m.requireCall,
      calledPocket: m.calledPocket,
    },
    { potted: res.potted, foul }
  );
  if (outcome !== null) {
    next.phase = "over";
    next.winner = outcome === "win" ? shooter : rival;
    next.message =
      outcome === "win"
        ? "黑星球稳稳落袋，这一局拿下啦！"
        : "黑星球提前落袋了，这一局让给对手，下一局把顺序理清楚就好。";
    return next;
  }

  // 台面开放时，这一杆第一颗合法落袋的非黑星球决定分组
  if (m.open && foul === "none") {
    const first = pottedKinds.find((k) => k === "warm" || k === "cool");
    if (first === "warm" || first === "cool") {
      next.groups[shooter] = first;
      next.groups[rival] = first === "warm" ? "cool" : "warm";
      next.open = false;
    }
  }

  if (foul !== "none") {
    next.fouls[shooter] = m.fouls[shooter] + 1;
    next.turn = rival;
    next.freeBall = true;
    next.message = FOUL_TEXT[foul];
    return maybeThreeFoul(next, shooter, rival);
  }

  next.fouls[shooter] = 0;
  const myGroup = next.groups[shooter];
  const pottedOwn = myGroup ? pottedKinds.filter((k) => k === myGroup).length : 0;
  const pottedRival = pottedKinds.filter((k) => k !== myGroup && k !== "cue" && k !== "black").length;
  const keep = pottedOwn > 0 || (OPPONENT_POT_KEEPS_TURN && pottedRival > 0);
  next.turn = keep ? shooter : rival;
  if (pottedOwn > 0) {
    next.message = `进了 ${pottedOwn} 颗，继续出杆！`;
  } else if (pottedRival > 0) {
    next.message = "这一颗算对方的，换对方出杆，下一次先看清颜色。";
  } else {
    next.message = "这一杆没进球，换对方出杆，别急，位置还不错。";
  }
  return next;
}

function maybeThreeFoul(next: MatchState, shooter: 0 | 1, rival: 0 | 1): MatchState {
  if (next.threeFoulLoss && next.fouls[shooter] >= FOUL_LIMIT) {
    next.phase = "over";
    next.winner = rival;
    next.message = `连着 ${FOUL_LIMIT} 杆犯规，这一局先让给对手，下一局放慢一点更稳。`;
  }
  return next;
}

/** 出杆方这一杆的合法目标（提示文案与电脑球手都用它） */
export function legalTarget(m: MatchState): BallKind | "any" {
  const group = m.groups[m.turn];
  if (group === null) return "any";
  return remainingOf(m.balls, group) === 0 ? "black" : group;
}

/** 台面上离某个点最近的袋号 */
export function nearestPocket(p: Vec): number {
  let best = 0;
  let bd = Number.POSITIVE_INFINITY;
  for (let i = 0; i < POCKETS.length; i++) {
    const d = dist(p, POCKETS[i]);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** 母球停在袋口里没有（视图判定用，落袋已经由物理层标记过了） */
export function cueInPocket(balls: readonly Ball[]): boolean {
  const cue = balls.find((b) => b.kind === "cue");
  if (!cue) return true;
  return cue.potted || pocketed(cue) >= 0;
}
