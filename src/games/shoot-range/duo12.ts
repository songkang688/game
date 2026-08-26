/**
 * 星星射击场 1.2 · 双人同屏。
 *
 * 1.1 是上下分屏：一人一块画布、一人一份完全一样的靶阵，两个人其实各玩各的。
 * 1.2 改成**同屏**：一套靶，两套准星，谁先打到算谁的，分数分列显示。
 * 朵朵是粉色准星，星星是蓝色准星；键盘两套键位并行，触屏按落点归属分给两个人，
 * 所以「一人用键盘一人用手指」「两个人各按半边屏幕」都能同时动。
 *
 * 两种同屏玩法：
 * - `versus`（比一比）：60 秒抢靶，分数高的赢。
 * - `twoPlayer`（一起打）：分数合并，一起够到目标分就双赢——谁也不用输。
 */
import { accuracy, duelResult } from "./logic";

/** 两个人的准星颜色（也用在分数列与触屏按钮上） */
export const DUO_INK = ["#B44F84", "#39699F"] as const;
/** 两个人的名字 */
export const DUO_NAME = ["朵朵", "星星"] as const;

/** 比一比一局多少秒 */
export const ARENA_SECONDS = 60;
/** 一起打一局多少秒 */
export const COOP_SECONDS = 75;

export interface DuoSide {
  name: string;
  score: number;
  hits: number;
  shots: number;
  friendHits: number;
  flowerHits: number;
}

export function makeDuoSide(index: number): DuoSide {
  return {
    name: DUO_NAME[index] ?? `${index + 1} 号`,
    score: 0,
    hits: 0,
    shots: 0,
    friendHits: 0,
    flowerHits: 0,
  };
}

export interface ArenaOutcome {
  /** 0 = 朵朵赢，1 = 星星赢，-1 = 平手 */
  winner: number;
  line: string;
}

/**
 * 比一比的判定：同屏抢靶比的是「抢到多少」，所以先比分数；
 * 分数打平再比命中率（复用 1.1 的 `duelResult`，误碰不许打的靶按少算一发有效命中）；
 * 还一样就是平手。
 */
export function arenaResult(a: DuoSide, b: DuoSide): ArenaOutcome {
  if (a.score !== b.score) {
    const winner = a.score > b.score ? 0 : 1;
    const win = winner === 0 ? a : b;
    const lose = winner === 0 ? b : a;
    return { winner, line: `${win.name} ${win.score} 分,${lose.name} ${lose.score} 分,${win.name}这一局手更稳!` };
  }
  const tie = duelResult(
    { name: a.name, hits: a.hits, shots: a.shots, friendHits: a.friendHits + a.flowerHits },
    { name: b.name, hits: b.hits, shots: b.shots, friendHits: b.friendHits + b.flowerHits }
  );
  if (tie.winner === -1) {
    return { winner: -1, line: `都是 ${a.score} 分,命中率也一样,这局打成平手,再来一局!` };
  }
  const win = tie.winner === 0 ? a : b;
  return {
    winner: tie.winner,
    line: `都是 ${a.score} 分!比命中率 ${Math.round(tie.accA * 100)}% 对 ${Math.round(tie.accB * 100)}%,${win.name}险胜。`,
  };
}

/** 一起打的目标分：第一局 300，往后每局加 120（越玩越有奔头） */
export function coopGoal(round: number): number {
  return 300 + Math.max(0, Math.floor(round) - 1) * 120;
}

export interface CoopOutcome {
  win: boolean;
  total: number;
  line: string;
}

/** 一起打的判定：两个人的分合起来算，够到目标分就一起赢 */
export function coopResult(a: DuoSide, b: DuoSide, round: number): CoopOutcome {
  const total = a.score + b.score;
  const goal = coopGoal(round);
  const acc = Math.round(accuracy(a.hits + b.hits, a.shots + b.shots) * 100);
  if (total >= goal) {
    return { win: true, total, line: `合起来 ${total} 分,目标 ${goal} 分达成!两个人的命中率 ${acc}%,配合真好。` };
  }
  return {
    win: false,
    total,
    line: `合起来 ${total} 分,离目标 ${goal} 分还差 ${goal - total} 分。命中率 ${acc}%,下一局分头包一边试试。`,
  };
}

/**
 * 触屏落点归谁：单人时都归 0 号；双人时按落点在画面左半边还是右半边分。
 * 只在**按下的那一刻**判一次，手指按下之后横穿到对面也还是自己的准星。
 */
export function assignSide(x: number, width: number, players: number): number {
  if (players <= 1 || !(width > 0)) return 0;
  return x < width / 2 ? 0 : 1;
}

/** 分数列的一行文字（HUD 两列各一条，颜色由 `DUO_INK` 决定） */
export function scoreColumn(side: DuoSide): string {
  const acc = Math.round(accuracy(side.hits, side.shots) * 100);
  return `${side.name} ${side.score} 分 · 命中 ${side.hits}/${side.shots}（${acc}%）`;
}
