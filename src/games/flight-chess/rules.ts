/**
 * 飞行棋乐园 · 规则内核（纯函数，不碰 DOM、不碰随机）。
 *
 * 一次移动的结算顺序永远是这四步，`resolveLanding` 就是把它们串起来:
 *   1. 逐格走（一格一格，绝不瞬移）;
 *   2. 走到终点还有剩步、或撞上敌方叠子 → 原路折返;
 *   3. 停在本色格 → 向前跳 4 格;停在航线格 → 沿航线飞 12 格（飞完就停，不再连跳）;
 *   4. 最终落点做撞子判定:单机绕回基地，叠子连自己一起绕回基地。
 */
import {
  BASE,
  COLOR_INFO,
  GOAL,
  JUMP_STEP,
  PLANES_PER_COLOR,
  RING_LEN,
  AIRLINE_TO,
  canJumpFrom,
  isAirline,
  isSafe,
  ringAt,
  type Color
} from "./board";
import { CLASSIC_RULES, canTakeOff, type Rules } from "./dice";

/**
 * 折返之后还要不要再触发跳格与航线。
 * 取 false:被挡回来 / 终点超步之后停在哪儿就是哪儿，只做撞子判定，
 * 免得一次移动无限连锁（规则只有这一套，不许两处各写一份）。
 */
export const BOUNCE_KEEPS_SHORTCUT = false;

/** 指一架具体的飞机 */
export interface PlaneRef {
  color: Color;
  idx: number;
}

/** 一色一路的计数（关卡目标与结算播报都读它） */
export interface Tally {
  takeOff: number;
  jump: number;
  fly: number;
  capture: number;
  /** 被撞回基地的次数（挨撞方记） */
  crashed: number;
  stack: number;
  bounce: number;
  finish: number;
}

export function emptyTally(): Tally {
  return { takeOff: 0, jump: 0, fly: 0, capture: 0, crashed: 0, stack: 0, bounce: 0, finish: 0 };
}

export interface FlightState {
  /** 参战颜色，按行动先后排 */
  seats: Color[];
  /** planes[色号][0..3] = 这架飞机的行程 p */
  planes: number[][];
  /** 轮到 seats 里的第几位 */
  turn: number;
  rules: Rules;
  /** 当前这一位连着掷了几个 6 */
  streak: number;
  /** 已经掷过几次（骰序游标） */
  diceIndex: number;
  /** 回合数（每位走完一轮算一回合） */
  round: number;
  tally: Tally[];
}

/** 开一局:没参战的颜色飞机全留在基地，永远不动 */
export function createState(seats: Color[], rules: Rules = CLASSIC_RULES): FlightState {
  return {
    seats: [...seats],
    planes: [0, 1, 2, 3].map(() => new Array<number>(PLANES_PER_COLOR).fill(BASE)),
    turn: 0,
    rules: { ...rules, takeOff: [...rules.takeOff] },
    streak: 0,
    diceIndex: 0,
    round: 0,
    tally: [0, 1, 2, 3].map(() => emptyTally())
  };
}

export function cloneState(s: FlightState): FlightState {
  return {
    seats: [...s.seats],
    planes: s.planes.map((row) => [...row]),
    turn: s.turn,
    rules: { ...s.rules, takeOff: [...s.rules.takeOff] },
    streak: s.streak,
    diceIndex: s.diceIndex,
    round: s.round,
    tally: s.tally.map((t) => ({ ...t }))
  };
}

/** 当前该谁走 */
export function currentColor(s: FlightState): Color {
  return s.seats[s.turn % s.seats.length];
}

/** 把某一色的飞机摆到指定行程（关卡布局用） */
export function place(s: FlightState, color: Color, positions: number[]): void {
  for (let i = 0; i < PLANES_PER_COLOR; i++) {
    s.planes[color][i] = positions[i] === undefined ? BASE : positions[i];
  }
}

/** 停在这个环线格上的所有飞机（基地与终点通道不算，天生安全） */
export function occupantsOfRing(s: FlightState, ring: number): PlaneRef[] {
  const out: PlaneRef[] = [];
  for (const color of s.seats) {
    for (let i = 0; i < PLANES_PER_COLOR; i++) {
      const p = s.planes[color][i];
      if (isSafe(p)) continue;
      if (ringAt(color, p) === ring) out.push({ color, idx: i });
    }
  }
  return out;
}

/** 这个环线格上有没有敌方叠子（同色 ≥ 2 架） */
export function enemyStackAt(s: FlightState, me: Color, ring: number): PlaneRef[] {
  const here = occupantsOfRing(s, ring).filter((r) => r.color !== me);
  return here.length >= 2 ? here : [];
}

/** 某一色自己有几处叠子 */
export function stackCount(s: FlightState, color: Color): number {
  const seen = new Map<number, number>();
  for (let i = 0; i < PLANES_PER_COLOR; i++) {
    const p = s.planes[color][i];
    if (isSafe(p)) continue;
    const ring = ringAt(color, p);
    seen.set(ring, (seen.get(ring) ?? 0) + 1);
  }
  let n = 0;
  for (const v of seen.values()) if (v >= 2) n++;
  return n;
}

/** 走到行程 p 会不会被敌方叠子挡住 */
function blockedCell(s: FlightState, me: Color, p: number): boolean {
  if (!s.rules.allowStackBlock) return false;
  if (p < 0 || p >= RING_LEN) return false;
  return enemyStackAt(s, me, ringAt(me, p)).length >= 2;
}

export interface WalkResult {
  to: number;
  /** 一格一格的落脚点，界面照着这个跳，绝不瞬移 */
  hops: number[];
  /** 折返过（终点超步或被叠子挡回） */
  bounced: boolean;
  /** 被敌方叠子挡回来过 */
  blocked: boolean;
}

/**
 * 终点通道折返:走到终点还有剩步，就在通道里原路退回来。
 * 纯算术，不看棋盘，测试直接对着算。
 */
export function bounceInHome(pos: number, steps: number): number {
  const raw = pos + steps;
  if (raw <= GOAL) return raw;
  const back = GOAL - (raw - GOAL);
  return Math.max(RING_LEN, back);
}

/**
 * 一格一格地走 steps 步，处理两种折返:
 *  - 走到终点还有剩步 → 在通道里往回退;
 *  - 走到敌方叠子头上还有剩步 → 原路折返（叠子挡路）。
 * 退回来的路是刚走过的路，所以回程不再判叠子;退到起飞格之前就停住。
 */
export function walkSteps(s: FlightState, color: Color, from: number, steps: number): WalkResult {
  let pos = from;
  let dir = 1;
  let bounced = false;
  let blocked = false;
  const hops: number[] = [];
  for (let i = 0; i < steps; i++) {
    let next = pos + dir;
    if (next > GOAL) {
      dir = -1;
      bounced = true;
      next = pos - 1;
    }
    if (next < 0) break;
    pos = next;
    hops.push(pos);
    const remaining = steps - i - 1;
    if (remaining > 0 && dir === 1 && blockedCell(s, color, pos)) {
      dir = -1;
      bounced = true;
      blocked = true;
    }
  }
  return { to: pos, hops, bounced, blocked };
}

/** 规格里点名的接口:这一步会不会被叠子挡回来 */
export function blockedByStack(s: FlightState, color: Color, from: number, steps: number): boolean {
  return walkSteps(s, color, from, steps).blocked;
}

export interface Landing {
  legal: boolean;
  from: number;
  to: number;
  hops: number[];
  jumped: boolean;
  flew: boolean;
  bounced: boolean;
  blocked: boolean;
  /** 被撞回基地的敌机 */
  captured: PlaneRef[];
  /** 撞上敌方叠子，自己也得绕回基地 */
  selfBack: boolean;
  arrived: boolean;
}

function emptyLanding(from: number): Landing {
  return {
    legal: false,
    from,
    to: from,
    hops: [],
    jumped: false,
    flew: false,
    bounced: false,
    blocked: false,
    captured: [],
    selfBack: false,
    arrived: false
  };
}

/**
 * 落点结算（纯函数）:给定局面、某架飞机和步数，算出它最后停在哪、撞掉了谁。
 * 不修改传进来的局面。
 */
export function resolveLanding(s: FlightState, plane: PlaneRef, steps: number): Landing {
  const from = s.planes[plane.color]?.[plane.idx] ?? BASE;
  const res = emptyLanding(from);
  if (from === BASE || from === GOAL || steps <= 0) return res;
  res.legal = true;

  const walk = walkSteps(s, plane.color, from, steps);
  res.hops = [...walk.hops];
  res.bounced = walk.bounced;
  res.blocked = walk.blocked;
  let to = walk.to;

  // 折返之后不再吃跳格与航线，只留撞子判定
  const shortcutOK = BOUNCE_KEEPS_SHORTCUT || !walk.bounced;
  if (shortcutOK) {
    if (s.rules.allowAirline && isAirline(to)) {
      to = AIRLINE_TO;
      res.flew = true;
      res.hops.push(to);
    } else if (s.rules.allowJump && canJumpFrom(to)) {
      to += JUMP_STEP;
      res.jumped = true;
      res.hops.push(to);
      // 由跳格进入航线格 → 飞完就停，不再连跳
      if (s.rules.allowAirline && isAirline(to)) {
        to = AIRLINE_TO;
        res.flew = true;
        res.hops.push(to);
      }
    }
  }

  res.to = to;
  res.arrived = to === GOAL;

  if (to >= 0 && to < RING_LEN) {
    const ring = ringAt(plane.color, to);
    const foes = occupantsOfRing(s, ring).filter((r) => r.color !== plane.color);
    if (foes.length === 1) {
      res.captured = foes;
    } else if (foes.length >= 2) {
      // 撞上敌方叠子:大家一起绕回基地，自己这架也不例外
      res.captured = foes;
      res.selfBack = true;
      res.to = BASE;
      res.arrived = false;
    }
  }
  return res;
}

/** 起飞:从基地飞到自己的起飞格，落点同样要判撞子 */
export function resolveTakeOff(s: FlightState, plane: PlaneRef): Landing {
  const from = s.planes[plane.color]?.[plane.idx] ?? BASE;
  const res = emptyLanding(from);
  if (from !== BASE) return res;
  res.legal = true;
  res.to = 0;
  res.hops = [0];
  const ring = ringAt(plane.color, 0);
  const foes = occupantsOfRing(s, ring).filter((r) => r.color !== plane.color);
  if (foes.length === 1) {
    res.captured = foes;
  } else if (foes.length >= 2) {
    res.captured = foes;
    res.selfBack = true;
    res.to = BASE;
  }
  return res;
}

/** 把结算结果落到局面上（原地修改），返回同一个局面方便串写 */
export function applyLanding(s: FlightState, plane: PlaneRef, res: Landing): FlightState {
  if (!res.legal) return s;
  const before = stackCount(s, plane.color);
  s.planes[plane.color][plane.idx] = res.to;
  for (const foe of res.captured) {
    s.planes[foe.color][foe.idx] = BASE;
    s.tally[foe.color].crashed++;
  }
  const t = s.tally[plane.color];
  if (res.captured.length > 0) t.capture += res.captured.length;
  if (res.jumped) t.jump++;
  if (res.flew) t.fly++;
  if (res.bounced) t.bounce++;
  if (res.arrived) t.finish++;
  if (res.from === BASE && res.to === 0) t.takeOff++;
  const after = stackCount(s, plane.color);
  if (after > before) t.stack += after - before;
  return s;
}

export type MoveKind = "takeOff" | "fly";

export interface Move {
  kind: MoveKind;
  plane: PlaneRef;
}

/** 这个点数下所有能走的棋（没有就返回空数组，表示这一手只能过） */
export function legalMoves(s: FlightState, dice: number): Move[] {
  const color = currentColor(s);
  const out: Move[] = [];
  const row = s.planes[color];
  if (canTakeOff(dice, s.rules)) {
    for (let i = 0; i < PLANES_PER_COLOR; i++) {
      if (row[i] === BASE) {
        out.push({ kind: "takeOff", plane: { color, idx: i } });
        break; // 基地里的飞机都一样，起飞只给一个选项，免得菜单里挤四个一模一样的按钮
      }
    }
  }
  for (let i = 0; i < PLANES_PER_COLOR; i++) {
    if (row[i] >= 0 && row[i] < GOAL) out.push({ kind: "fly", plane: { color, idx: i } });
  }
  return out;
}

/** 走一步棋:结算 + 落地，返回结算结果 */
export function applyMove(s: FlightState, move: Move, dice: number): Landing {
  const res = move.kind === "takeOff" ? resolveTakeOff(s, move.plane) : resolveLanding(s, move.plane, dice);
  applyLanding(s, move.plane, res);
  return res;
}

/** 轮到下一位（连掷时不要调它） */
export function nextTurn(s: FlightState): void {
  s.turn = (s.turn + 1) % s.seats.length;
  s.streak = 0;
  if (s.turn === 0) s.round++;
}

/** 某一色 4 架是不是全到齐了 */
export function allHome(s: FlightState, color: Color): boolean {
  return s.planes[color].every((p) => p === GOAL);
}

/** 某一色到齐了几架 */
export function homeCount(s: FlightState, color: Color): number {
  return s.planes[color].filter((p) => p === GOAL).length;
}

/** 某一色的总行程（名次的第二排序键） */
export function progressOf(s: FlightState, color: Color): number {
  return s.planes[color].reduce((sum, p) => sum + (p === BASE ? 0 : p + 1), 0);
}

/** 名次:先看到齐几架，再看总行程，最后按座位顺序 */
export function rankOf(s: FlightState): Color[] {
  return [...s.seats].sort((a, b) => {
    const ha = homeCount(s, a);
    const hb = homeCount(s, b);
    if (ha !== hb) return hb - ha;
    const pa = progressOf(s, a);
    const pb = progressOf(s, b);
    if (pa !== pb) return pb - pa;
    return a - b;
  });
}

/** 已经有人 4 架到齐就返回那一色，否则 null */
export function winnerOf(s: FlightState): Color | null {
  for (const c of s.seats) if (allHome(s, c)) return c;
  return null;
}

/** 一句中文播报（界面与测试共用） */
export function landingLine(plane: PlaneRef, res: Landing): string {
  const who = COLOR_INFO[plane.color].name;
  if (!res.legal) return `${who}这一手过。`;
  const bits: string[] = [];
  if (res.from === BASE) bits.push(`${who}的飞机起飞啦`);
  else bits.push(`${who}向前走了 ${res.hops.length} 步`);
  if (res.blocked) bits.push("前面有一座叠机堡垒，只好原路飞回来");
  else if (res.bounced) bits.push("到终点还有多的步数，在通道里折返");
  if (res.jumped) bits.push("踩到本色格，向前跳了 4 格");
  if (res.flew) bits.push("接上虚线航线，一路飞到对面");
  if (res.selfBack) bits.push("撞进对方的叠机堡垒，大家一起绕回基地重新出发");
  else if (res.captured.length === 1) {
    bits.push(`把 ${COLOR_INFO[res.captured[0].color].name} 的一架送回基地`);
  } else if (res.captured.length > 1) {
    bits.push(`把 ${COLOR_INFO[res.captured[0].color].name} 的 ${res.captured.length} 架一起送回基地`);
  }
  if (res.arrived) bits.push("正好停在终点");
  return `${bits.join("，")}。`;
}
