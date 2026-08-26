// 保龄球小馆 · 计分器(纯函数,不碰任何 DOM 与随机数)。
//
// 保龄球的分数不是把倒瓶数加起来那么简单:
//  - 全中(第一球就把 10 瓶打光):这一格记 10 分,再加上后面两球的瓶数;
//  - 补中(两球合计打光 10 瓶):这一格记 10 分,再加上后面一球的瓶数;
//  - 打不完(失误):就记两球的瓶数;
//  - 第十格特殊:全中给两次加投、补中给一次加投,三球的瓶数直接相加。
//
// 因为奖励要用「后面的球」来算,一格的分数常常要等到后面才结算得出来,
// 所以每一格的 score 允许是 null(还没算得出来),UI 照着它显示空格。
// 这套规则全部写在这一个文件里,并且是纯函数——单测能把 300 分、全场补中、
// 第十格的各种情况一条一条钉死。

/** 一格的类型:strike=全中 spare=补中 open=打不完 none=还没投 */
export type FrameKind = "strike" | "spare" | "open" | "none";

export interface FrameScore {
  /** 这一格实际投出的每一球的瓶数 */
  rolls: number[];
  kind: FrameKind;
  /** 这一格自己拿到的分(含奖励);还算不出来就是 null */
  score: number | null;
  /** 累计到这一格为止的总分;还算不出来就是 null */
  running: number | null;
  /** 这一格已经投完了(第十格含加投) */
  done: boolean;
}

export interface GameScore {
  frames: FrameScore[];
  /** 已经结算出来的总分 */
  total: number;
  /** 整局投完了 */
  complete: boolean;
}

/** 一局几格(标准就是 10 格) */
export const FRAMES = 10;

/** 一次满架有几个瓶 */
export const PINS = 10;

/** 把任意输入夹成 0..10 的整数瓶数 */
export function cleanRoll(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.max(0, Math.min(PINS, n));
}

/** 把一串投球记录整理干净(过滤掉非法值) */
export function cleanRolls(rolls: readonly unknown[]): number[] {
  return rolls.map(cleanRoll);
}

/**
 * 给一串投球记录算分。
 *
 * rolls 是「从第一格第一球开始、按顺序排下来的每一球倒了几瓶」,
 * 全中的那一格只占一个数字(因为第二球不用投)。
 * frameCount 允许小于 10:闯关模式一关只打两三格,用的还是这一套规则。
 */
export function scoreGame(rolls: readonly number[], frameCount: number = FRAMES): GameScore {
  const total = Math.max(1, Math.round(frameCount));
  const r = cleanRolls(rolls);
  const frames: FrameScore[] = [];
  let i = 0;
  let running = 0;
  let runningBroken = false;

  for (let f = 0; f < total; f++) {
    const last = f === total - 1;
    const frame: FrameScore = { rolls: [], kind: "none", score: null, running: null, done: false };

    if (last) {
      const a = r[i];
      const b = r[i + 1];
      const c = r[i + 2];
      if (a !== undefined) frame.rolls.push(a);
      if (b !== undefined) frame.rolls.push(b);
      // 前两球打光 10 瓶(全中或补中)才有第三球
      const bonusEarned = a === PINS || (a !== undefined && b !== undefined && a + b === PINS);
      if (bonusEarned && c !== undefined) frame.rolls.push(c);
      if (a === PINS) frame.kind = "strike";
      else if (a !== undefined && b !== undefined) frame.kind = a + b === PINS ? "spare" : "open";
      const need = bonusEarned ? 3 : 2;
      frame.done = frame.rolls.length >= need && (a !== undefined && b !== undefined);
      if (frame.done) frame.score = frame.rolls.reduce((s, v) => s + v, 0);
      i += frame.rolls.length;
    } else {
      const a = r[i];
      if (a === PINS) {
        frame.rolls.push(PINS);
        frame.kind = "strike";
        frame.done = true;
        const b = r[i + 1];
        const c = r[i + 2];
        if (b !== undefined && c !== undefined) frame.score = PINS + b + c;
        i += 1;
      } else if (a !== undefined) {
        const b = r[i + 1];
        frame.rolls.push(a);
        if (b !== undefined) {
          frame.rolls.push(b);
          frame.done = true;
          if (a + b === PINS) {
            frame.kind = "spare";
            const c = r[i + 2];
            if (c !== undefined) frame.score = PINS + c;
          } else {
            frame.kind = "open";
            frame.score = a + b;
          }
          i += 2;
        } else {
          // 这一格只投了一球,还没投完
          i += 1;
        }
      }
    }

    if (frame.score !== null && !runningBroken) {
      running += frame.score;
      frame.running = running;
    } else if (frame.score === null) {
      // 中间有一格还没结算,后面的累计分也就先空着
      runningBroken = true;
    }
    frames.push(frame);
  }

  return {
    frames,
    total: frames.reduce((s, f) => s + (f.score ?? 0), 0),
    complete: frames.every((f) => f.done && f.score !== null),
  };
}

/** 只要总分(UI 的记分牌头顶那个大数字) */
export function totalScore(rolls: readonly number[], frameCount: number = FRAMES): number {
  return scoreGame(rolls, frameCount).total;
}

// ---------------------------------------------------------------------------
// 下一球该怎么投:给对局循环用
// ---------------------------------------------------------------------------

export interface TurnState {
  /** 下一球属于第几格(0 基);整局投完就等于 frameCount */
  frame: number;
  /** 这一格的第几球(0 基) */
  ball: number;
  /** 下一球要不要重新摆满一架 */
  freshRack: boolean;
  /** 下一球开球前场上还站着几个瓶 */
  standing: number;
  /** 整局已经投完 */
  over: boolean;
}

/**
 * 从投球记录推出「下一球该怎么投」。
 * 第十格的加投会重新摆瓶,这里一并算好,免得对局循环自己数格子数错。
 */
export function turnState(rolls: readonly number[], frameCount: number = FRAMES): TurnState {
  const total = Math.max(1, Math.round(frameCount));
  const r = cleanRolls(rolls);
  let i = 0;
  for (let f = 0; f < total; f++) {
    const last = f === total - 1;
    if (last) {
      const a = r[i];
      const b = r[i + 1];
      const c = r[i + 2];
      if (a === undefined) return { frame: f, ball: 0, freshRack: true, standing: PINS, over: false };
      if (b === undefined) {
        // 第一球全中就重新摆一架,否则接着打剩下的
        return { frame: f, ball: 1, freshRack: a === PINS, standing: a === PINS ? PINS : PINS - a, over: false };
      }
      const bonusEarned = a === PINS || a + b === PINS;
      if (!bonusEarned) break;
      if (c === undefined) {
        // 第三球:前两球把这一架打光了就重摆,否则接着打站着的
        const cleared = a === PINS ? b === PINS : true;
        return { frame: f, ball: 2, freshRack: cleared, standing: cleared ? PINS : PINS - b, over: false };
      }
      break;
    }
    const a = r[i];
    if (a === undefined) return { frame: f, ball: 0, freshRack: true, standing: PINS, over: false };
    if (a === PINS) {
      i += 1;
      continue;
    }
    const b = r[i + 1];
    if (b === undefined) return { frame: f, ball: 1, freshRack: false, standing: PINS - a, over: false };
    i += 2;
  }
  return { frame: total, ball: 0, freshRack: true, standing: PINS, over: true };
}

/** 这一局最多还能拿多少分(用来判断「还有没有希望达标」) */
export function maxRemaining(rolls: readonly number[], frameCount: number = FRAMES): number {
  const state = turnState(rolls, frameCount);
  if (state.over) return 0;
  // 每一格全中最多值 30 分,粗略给个上限就够 UI 提示用了
  const framesLeft = Math.max(0, frameCount - state.frame);
  return framesLeft * 30;
}

// ---------------------------------------------------------------------------
// 文案
// ---------------------------------------------------------------------------

/** 一球的记号:X=全中 /=补中 -=没打中 */
export function rollMark(frame: FrameScore, index: number): string {
  const v = frame.rolls[index];
  if (v === undefined) return "";
  if (v === PINS) return "X";
  if (index > 0) {
    const prev = frame.rolls[index - 1];
    if (prev !== PINS && prev + v === PINS) return "/";
    // 第十格里前一球是全中,这一球又打光一架,照样记 X
    if (prev === PINS && v === PINS) return "X";
  }
  return v === 0 ? "-" : String(v);
}

/** 整格的记号,例如「X」「7 /」「6 2」 */
export function frameMarks(frame: FrameScore): string {
  return frame.rolls.map((_, i) => rollMark(frame, i)).join(" ");
}
