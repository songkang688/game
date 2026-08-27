// 彩虹跑跑 · 幽灵竞速(1.2 第 9 步新增)
//
// 把一次无尽跑的操作录下来:换道 / 跳 / 滑,各带一个毫秒时间戳。
// 下一趟开跑时,同一条路上会多出一个半透明的自己,按上一趟的时间线重跑一遍。
//
// 录的是**操作**而不是每帧的坐标,所以一趟三分钟的快照也就几百个事件、一行字符串,
// 塞进 localStorage 毫无压力。回放靠同一台状态机重算,不存任何逐帧数据。
//
// 两条硬上限:最多录 3 分钟、最多 1200 个事件。真有孩子按着方向键狂搓,
// 快照也不会把存档撑爆——超出的部分直接丢掉,幽灵跑到那里就站住不动。

import type { RunInput } from "./controls";
import { JUMP_TIME, SLIDE_TIME, clampLane } from "./logic";
import type { PlayerAction } from "./logic";

/** 一次快照最多录多久(毫秒):3 分钟。 */
export const GHOST_MAX_MS = 180_000;
/** 一次快照最多录多少个事件。 */
export const GHOST_MAX_EVENTS = 1200;
/** 幽灵存档 key(和战役、无尽纪录都分开,互不影响)。 */
export const GHOST_KEY = "yiduo-yixing.rainbow-run.ghost.v1";

export interface GhostEvent {
  /** 从起跑那一刻算起的毫秒数(整数) */
  t: number;
  input: RunInput;
}

export interface GhostRun {
  /** 录这一趟时跑了多少米 */
  meters: number;
  events: GhostEvent[];
}

/** 序列化时每种操作对应的一个大写字母(大写是为了不和 36 进制的小写数字撞)。 */
const CODE: Readonly<Record<RunInput, string>> = {
  left: "L",
  right: "R",
  jump: "J",
  roll: "S",
};

const INPUT_OF: Readonly<Record<string, RunInput>> = {
  L: "left",
  R: "right",
  J: "jump",
  S: "roll",
};

export function emptyGhost(): GhostRun {
  return { meters: 0, events: [] };
}

function safeMeters(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 把一份快照收进上限里:时间戳排好序、去掉三分钟以外的、事件数封顶。
 * 录的时候和读存档的时候都过一遍,存进来的和跑出来的永远是同一个口径。
 */
export function clampGhost(run: GhostRun): GhostRun {
  const events: GhostEvent[] = [];
  let last = -1;
  for (const e of run.events) {
    if (!INPUT_OF[CODE[e.input] ?? ""]) continue;
    const t = Math.max(0, Math.round(Number(e.t)));
    if (!Number.isFinite(t) || t > GHOST_MAX_MS) continue;
    // 时间戳必须单调不减,乱序的直接丢——回放是一遍过的,回不了头
    if (t < last) continue;
    last = t;
    events.push({ t, input: e.input });
    if (events.length >= GHOST_MAX_EVENTS) break;
  }
  return { meters: safeMeters(run.meters), events };
}

/** 这份快照覆盖到第几毫秒。 */
export function ghostDurationMs(run: GhostRun): number {
  return run.events.length === 0 ? 0 : run.events[run.events.length - 1].t;
}

/** 录一趟:只往里塞事件,超上限就静静地不再收。 */
export class GhostRecorder {
  private readonly events: GhostEvent[] = [];

  /** tMs = 从起跑算起的毫秒数。 */
  push(tMs: number, input: RunInput): void {
    if (this.events.length >= GHOST_MAX_EVENTS) return;
    const t = Math.round(tMs);
    if (!Number.isFinite(t) || t < 0 || t > GHOST_MAX_MS) return;
    const last = this.events[this.events.length - 1];
    this.events.push({ t: last && t < last.t ? last.t : t, input });
  }

  get count(): number {
    return this.events.length;
  }

  finish(meters: number): GhostRun {
    return clampGhost({ meters, events: this.events });
  }
}

/* ------------------------------------------------------------------ */
/* 序列化:一行字符串                                                  */
/* ------------------------------------------------------------------ */

/** 快照文本的开头,一眼认得出是彩虹跑跑的幽灵。 */
export const GHOST_PREFIX = "rr-ghost/1/";

/**
 * 压成 `rr-ghost/1/<米数>/<间隔36进制><操作字母>...`。
 * 时间戳存的是与上一个事件的差,连着搓方向键的那一串差值都是两三位,
 * 所以三分钟的快照通常只有一两千个字符。
 */
export function serializeGhost(run: GhostRun): string {
  const g = clampGhost(run);
  let prev = 0;
  let body = "";
  for (const e of g.events) {
    body += (e.t - prev).toString(36) + CODE[e.input];
    prev = e.t;
  }
  return `${GHOST_PREFIX}${g.meters}/${body}`;
}

/** 读回来;认不出的文本一律当没有幽灵,绝不因为一行坏数据把无尽模式卡住。 */
export function parseGhost(raw: string | null | undefined): GhostRun | null {
  if (typeof raw !== "string" || !raw.startsWith(GHOST_PREFIX)) return null;
  const rest = raw.slice(GHOST_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash < 0) return null;
  const meters = safeMeters(rest.slice(0, slash));
  const body = rest.slice(slash + 1);
  const events: GhostEvent[] = [];
  let t = 0;
  let digits = "";
  for (const ch of body) {
    const input = INPUT_OF[ch];
    if (input) {
      const delta = Number.parseInt(digits === "" ? "0" : digits, 36);
      if (!Number.isFinite(delta) || delta < 0) return null;
      t += delta;
      events.push({ t, input });
      digits = "";
      continue;
    }
    if (!/[0-9a-z]/.test(ch)) return null;
    digits += ch;
  }
  // 结尾还剩一截数字说明这行字被截断了
  if (digits !== "") return null;
  return clampGhost({ meters, events });
}

/* ------------------------------------------------------------------ */
/* 回放                                                                */
/* ------------------------------------------------------------------ */

export interface GhostState {
  lane: number;
  action: PlayerAction;
  /** 这个动作还剩多久(秒) */
  actionTimer: number;
  /** 快照已经放完了 */
  finished: boolean;
}

function initialState(): GhostState {
  return { lane: 1, action: "run", actionTimer: 0, finished: false };
}

/** 幽灵吃下一个操作。动作用的时长和真人完全一致,不然两个人跑起来不像同一款游戏。 */
function applyInput(state: GhostState, input: RunInput): void {
  if (input === "left") {
    state.lane = clampLane(state.lane - 1);
    return;
  }
  if (input === "right") {
    state.lane = clampLane(state.lane + 1);
    return;
  }
  if (input === "jump") {
    if (state.action === "jump") return;
    state.action = "jump";
    state.actionTimer = JUMP_TIME;
    return;
  }
  if (state.action === "slide") return;
  state.action = "slide";
  state.actionTimer = SLIDE_TIME;
}

/**
 * 一遍过的回放器:只能往前 seek。
 * 游戏循环每帧调一次 `seek(当前毫秒)`,内部游标顺着事件表往下走,不会重头再算。
 */
export class GhostPlayer {
  private readonly run: GhostRun;
  private state: GhostState = initialState();
  private cursor = 0;
  private clock = 0;

  constructor(run: GhostRun) {
    this.run = clampGhost(run);
  }

  reset(): void {
    this.state = initialState();
    this.cursor = 0;
    this.clock = 0;
  }

  get meters(): number {
    return this.run.meters;
  }

    get durationMs(): number {
      return ghostDurationMs(this.run);
    }

    /** 上一趟跑到第 tMs 毫秒时大概在第几米(只用来画名牌上的领先 / 落后)。 */
    metersAt(tMs: number): number {
      return ghostMetersAt(this.run, tMs);
    }

  /** 推进到第 tMs 毫秒,返回幽灵这一刻的样子。 */
  seek(tMs: number): GhostState {
    const t = Math.max(this.clock, Number.isFinite(tMs) ? tMs : this.clock);
    const dt = (t - this.clock) / 1000;
    this.clock = t;
    while (this.cursor < this.run.events.length && this.run.events[this.cursor].t <= t) {
      applyInput(this.state, this.run.events[this.cursor].input);
      this.cursor++;
    }
    if (this.state.actionTimer > 0) {
      this.state.actionTimer -= dt;
      if (this.state.actionTimer <= 0) {
        this.state.actionTimer = 0;
        this.state.action = "run";
      }
    }
    this.state.finished = this.cursor >= this.run.events.length && t >= this.durationMs;
    return { ...this.state };
  }
}

/** 纯函数版回放:从头算到第 tMs 毫秒,给单测量用。 */
export function ghostStateAt(run: GhostRun, tMs: number, stepMs = 16): GhostState {
  const player = new GhostPlayer(run);
  const step = Math.max(1, stepMs);
  let t = 0;
  let out = player.seek(0);
  while (t < tMs) {
    t = Math.min(tMs, t + step);
    out = player.seek(t);
  }
  return out;
}

/** 这一趟有没有跑赢上一趟的幽灵。 */
export function beatsGhost(meters: number, ghost: GhostRun | null): boolean {
  return !!ghost && Math.floor(meters) > ghost.meters;
}

/** 幽灵跑到这一刻大概在第几米(按上一趟的平均速度铺开,只用来画名牌)。 */
export function ghostMetersAt(run: GhostRun, tMs: number): number {
  const dur = ghostDurationMs(run);
  if (dur <= 0) return run.meters;
  return (run.meters * Math.max(0, Math.min(dur, tMs))) / dur;
}

/** 名牌上这一刻的三种状态:领先 / 并排 / 落后。 */
export type GhostGapState = "ahead" | "even" | "behind";

export interface GhostGap {
  state: GhostGapState;
  /** 差多少米(取整,永远是非负数;并排就是 0) */
  meters: number;
}

/**
 * 这一刻领先还是落后上一趟的自己。整米比较:
 * 差不到一米就算**并排**——名牌上写「领先 0 米」既不好懂也不好看。
 */
export function ghostGap(meters: number, ghostMeters: number): GhostGap {
  const mine = Math.round(Number.isFinite(meters) ? meters : 0);
  const theirs = Math.round(Number.isFinite(ghostMeters) ? ghostMeters : 0);
  const diff = mine - theirs;
  if (diff === 0) return { state: "even", meters: 0 };
  return diff > 0 ? { state: "ahead", meters: diff } : { state: "behind", meters: -diff };
}

/** 名牌上的一行字。 */
export function ghostGapLine(gap: GhostGap): string {
  if (gap.state === "even") return "👻 并排跑着呢";
  return gap.state === "ahead" ? `👻 领先 ${gap.meters} 米` : `👻 落后 ${gap.meters} 米`;
}
