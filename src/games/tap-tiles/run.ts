/**
 * 音符下落 · 一次演奏的状态机(纯逻辑,不碰 DOM)。
 *
 * 视图每帧把当前时间喂给 `advanceTo`,玩家的点击 / 松手走 `tapLane` / `releaseLane`,
 * 机器人回放走的也是同一套函数——界面上看到的判定和测试里跑的判定是同一份代码。
 */
import type { Chart, Note } from "./chart";
import {
  CAMPAIGN_MAX_MISS,
  EMPTY_LINE,
  ENDLESS_MAX_MISS,
  GOOD_MS,
  HOLD_TAIL_MS,
  MISS_LINE,
  judge,
  scoreCombo,
  type Judgement,
} from "./judge";

/** 点到空白格怎么算:combo = 只断连击,end = 直接收工 */
export type EmptyRule = "combo" | "end";

export interface RunRules {
  emptyRule: EmptyRule;
  /** 允许 miss 几次,超过就结束(闯关 3,无尽 0) */
  maxMiss: number;
}

/** 闯关前两章:点空只断连击 */
export const CAMPAIGN_SOFT_RULES: RunRules = { emptyRule: "combo", maxMiss: CAMPAIGN_MAX_MISS };
/** 闯关第三章起:点空即结束 */
export const CAMPAIGN_STRICT_RULES: RunRules = { emptyRule: "end", maxMiss: CAMPAIGN_MAX_MISS };
/** 无尽:0 容错 */
export const ENDLESS_RULES: RunRules = { emptyRule: "end", maxMiss: ENDLESS_MAX_MISS };

export type NoteStatus = "waiting" | "holding" | "done" | "missed";

export interface NoteState {
  note: Note;
  status: NoteStatus;
  /** 按下时判的档(长按条按到尾才落账) */
  head: Judgement | null;
  /** 按下的时刻,画流动效果用 */
  downMs: number;
}

export type EventKind = "perfect" | "good" | "miss" | "empty" | "hold";

export interface RunEvent {
  kind: EventKind;
  lane: number;
  timeMs: number;
  /** 这一下加了多少分 */
  gain: number;
}

/** 结束原因:cleared = 打完了,miss = miss 用光了,empty = 点到空白格 */
export type RunEnd = "" | "cleared" | "miss" | "empty";

export interface RunState {
  chart: Chart;
  rules: RunRules;
  timeMs: number;
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  good: number;
  miss: number;
  /** 点空白格的次数 */
  empty: number;
  notes: NoteState[];
  over: boolean;
  cleared: boolean;
  ended: RunEnd;
  /** 最近一次要显示的提示语 */
  message: string;
  /** 这一帧新产生的事件,视图取走后自己清空 */
  events: RunEvent[];
}

export function createRun(chart: Chart, rules: RunRules): RunState {
  return {
    chart,
    rules,
    timeMs: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    good: 0,
    miss: 0,
    empty: 0,
    notes: chart.notes.map((note) => ({ note, status: "waiting", head: null, downMs: 0 })),
    over: false,
    cleared: false,
    ended: "",
    message: "",
    events: [],
  };
}

function push(state: RunState, kind: EventKind, lane: number, gain: number): RunEvent {
  const ev: RunEvent = { kind, lane, timeMs: state.timeMs, gain };
  state.events.push(ev);
  return ev;
}

/** 记一次命中:先加连击再按新连击算倍率 */
function registerHit(state: RunState, judgement: Judgement, lane: number): RunEvent {
  state.combo++;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  if (judgement === "perfect") state.perfect++;
  else state.good++;
  const gain = scoreCombo(judgement, state.combo);
  state.score += gain;
  return push(state, judgement, lane, gain);
}

/** 记一次 miss:断连击,超过容错就收工 */
function registerMiss(state: RunState, lane: number): RunEvent {
  state.combo = 0;
  state.miss++;
  state.message = MISS_LINE;
  const ev = push(state, "miss", lane, 0);
  if (state.miss > state.rules.maxMiss) end(state, "miss");
  return ev;
}

function end(state: RunState, reason: RunEnd): void {
  if (state.over) return;
  state.over = true;
  state.ended = reason;
  state.cleared = reason === "cleared";
}

/** 点到没有块的那条轨 */
export function hitEmpty(state: RunState, lane: number, timeMs = state.timeMs): RunEvent {
  state.timeMs = Math.max(state.timeMs, timeMs);
  state.empty++;
  state.combo = 0;
  const ev = push(state, "empty", lane, 0);
  if (state.rules.emptyRule === "end") {
    state.message = "点到空白格啦,这一轮先到这儿";
    end(state, "empty");
  } else {
    state.message = EMPTY_LINE;
  }
  return ev;
}

/** 还没结算的音符还剩几个 */
export function pendingCount(state: RunState): number {
  return state.notes.filter((n) => n.status === "waiting" || n.status === "holding").length;
}

/**
 * 把时间推到 timeMs:
 * 过了良好窗口还没点的块判 miss;按住到尾的长按条自动完成。
 */
export function advanceTo(state: RunState, timeMs: number): void {
  if (state.over) {
    state.timeMs = Math.max(state.timeMs, timeMs);
    return;
  }
  state.timeMs = Math.max(state.timeMs, timeMs);
  for (const ns of state.notes) {
    if (state.over) break;
    if (ns.status === "waiting" && ns.note.time + GOOD_MS < state.timeMs) {
      ns.status = "missed";
      registerMiss(state, ns.note.lane);
    } else if (ns.status === "holding" && ns.note.time + ns.note.hold <= state.timeMs) {
      ns.status = "done";
      registerHit(state, ns.head ?? "good", ns.note.lane);
    }
  }
  if (!state.over && pendingCount(state) === 0 && state.timeMs >= state.chart.durationMs) {
    end(state, "cleared");
  }
}

/** 这条轨上离 timeMs 最近、还能点的块 */
function nearestWaiting(state: RunState, lane: number, timeMs: number): NoteState | null {
  let best: NoteState | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const ns of state.notes) {
    if (ns.status !== "waiting" || ns.note.lane !== lane) continue;
    const gap = Math.abs(timeMs - ns.note.time);
    if (gap <= GOOD_MS && gap < bestGap) {
      best = ns;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * 点一下某条轨。窗口里有块就判定,没有就是点空白。
 * 长按条这里只记按下,分数等按到尾再落账。
 */
export function tapLane(state: RunState, lane: number, timeMs: number): RunEvent | null {
  if (state.over) return null;
  advanceTo(state, timeMs);
  if (state.over) return null;
  const target = nearestWaiting(state, lane, timeMs);
  if (!target) return hitEmpty(state, lane, timeMs);

  const head = judge(timeMs - target.note.time);
  if (head === "miss") return hitEmpty(state, lane, timeMs);
  target.head = head;
  target.downMs = timeMs;
  if (target.note.hold > 0) {
    target.status = "holding";
    return push(state, "hold", lane, 0);
  }
  target.status = "done";
  return registerHit(state, head, lane);
}

/** 松手。长按条撑到尾端才算完成,中途松手判 miss */
export function releaseLane(state: RunState, lane: number, timeMs: number): RunEvent | null {
  if (state.over) return null;
  const holding = state.notes.find((n) => n.status === "holding" && n.note.lane === lane);
  if (!holding) {
    state.timeMs = Math.max(state.timeMs, timeMs);
    return null;
  }
  state.timeMs = Math.max(state.timeMs, timeMs);
  const end0 = holding.note.time + holding.note.hold;
  if (timeMs >= end0 - HOLD_TAIL_MS) {
    holding.status = "done";
    return registerHit(state, holding.head ?? "good", lane);
  }
  holding.status = "missed";
  state.message = MISS_LINE;
  return registerMiss(state, lane);
}

/** 强行收尾(离开关卡、时间到) */
export function finishRun(state: RunState): void {
  if (state.over) return;
  advanceTo(state, Math.max(state.timeMs, state.chart.durationMs));
  if (!state.over) end(state, "cleared");
}

/** 命中率:命中的块占总块数的比例(0..1) */
export function accuracy(state: RunState): number {
  const total = state.notes.length;
  if (total === 0) return 1;
  return (state.perfect + state.good) / total;
}

/** 完美率:完美的块占总块数的比例(0..1) */
export function perfectRate(state: RunState): number {
  const total = state.notes.length;
  if (total === 0) return 1;
  return state.perfect / total;
}
