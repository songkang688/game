/**
 * 萌猫小屋 · 七种照顾任务的判定（1.2 从 `index.ts` 抽出来的纯函数层）。
 *
 * 每一种任务都是「进去一个状态 + 一次操作，出来一个新状态和这一下算不算数」，
 * 不碰 DOM、不读时间、不掷骰子（要随机就从种子里来），所以整份可以单测。
 * `index.ts` 只负责把手指的位置喂进来、把结果画出去。
 *
 * 1.2 的硬要求是**七种手感不许换皮**：
 *  喂饭＝把对的食物拖进碗；逗猫＝逗猫棒要被追上才扑；洗澡＝画圈搓到覆盖率够；
 *  哄睡＝踩着节拍点音符；打扮＝拖到吸附点；看病＝先观察再照料且能回退；
 *  搭配＝按写死的规则表评分并逐条讲理由。
 */
import { mulberry32, shuffled } from "../level99";
import {
  CURE_TOOLS,
  type CureRound,
  type CureTool,
  type StyleItem,
  type StyleTheme,
  styleGrade
} from "./levels";

/** 一次操作的结果：新状态 + 这一下发生了什么 */
export interface TaskOutcome<S> {
  state: S;
  /** 这一下有没有真的作用到游戏上（false＝拖到空地之类，什么都没发生） */
  acted: boolean;
  /** 算不算做岔了一次（要扣心情、要计入星级） */
  miss: boolean;
  /** 这个任务完成了 */
  done: boolean;
  /** 给孩子看的一句话（永远是鼓励或说明，不批评） */
  note: string;
}

function outcome<S>(state: S, patch: Partial<Omit<TaskOutcome<S>, "state">> = {}): TaskOutcome<S> {
  return { state, acted: false, miss: false, done: false, note: "", ...patch };
}

// ---------------------------------------------------------------------------
// ① 喂饭：挑对食物，拖进碗里
// ---------------------------------------------------------------------------

export interface FoodItem {
  emoji: string;
  name: string;
  /** 猫爱不爱吃：不爱吃的拖进碗里它只会摇头 */
  liked: boolean;
}

/** 猫爱吃的（原创小食谱，不写任何品牌） */
export const FOODS: readonly FoodItem[] = [
  { emoji: "🐟", name: "小鱼干", liked: true },
  { emoji: "🥛", name: "温牛奶", liked: true },
  { emoji: "🍗", name: "煮鸡肉", liked: true },
  { emoji: "🍤", name: "小虾仁", liked: true },
  { emoji: "🥩", name: "小肉粒", liked: true },
  { emoji: "🧀", name: "奶酪块", liked: true }
];

/** 猫不爱吃的：不是坏东西，只是它不感兴趣，拖进碗里会被推开 */
export const DISLIKED_FOODS: readonly FoodItem[] = [
  { emoji: "🍋", name: "酸柠檬", liked: false },
  { emoji: "🥦", name: "西兰花", liked: false },
  { emoji: "🥬", name: "大白菜", liked: false }
];

export const ALL_FOODS: readonly FoodItem[] = [...FOODS, ...DISLIKED_FOODS];

export interface FeedState {
  want: FoodItem;
  options: FoodItem[];
  /** 已经放进碗里的那件（用来画碗） */
  bowl: string | null;
  done: boolean;
}

/**
 * 排一次喂饭：抽一样想吃的，再配上若干爱吃但不是它想要的、
 * 以及至少一样它压根不爱吃的（这就是「有猫不爱吃的食物」）。
 */
export function buildFeed(seed: number, optionCount: number): FeedState {
  const n = Math.max(2, Math.min(ALL_FOODS.length, Math.floor(optionCount)));
  const rand = mulberry32(seed);
  const want = FOODS[Math.floor(rand() * FOODS.length)];
  const dislike = DISLIKED_FOODS[Math.floor(rand() * DISLIKED_FOODS.length)];
  const others = shuffled(
    FOODS.filter((f) => f.name !== want.name),
    mulberry32(seed * 17 + 5)
  ).slice(0, Math.max(0, n - 2));
  return {
    want,
    options: shuffled([want, dislike, ...others], mulberry32(seed * 31 + 7)),
    bowl: null,
    done: false
  };
}

/**
 * 把一样食物拖到某处松手。
 * 没拖到碗里＝什么都没发生（不算失误，孩子可以随便拖着玩）；
 * 拖进碗里的是它不爱吃的或者不是它要的＝只是摇摇头，重新来。
 */
export function feedDrop(state: FeedState, foodName: string, onBowl: boolean): TaskOutcome<FeedState> {
  if (state.done) return outcome(state, { done: true });
  if (!onBowl) return outcome(state, { note: "食物要拖到饭碗里才算哦～" });
  const food = state.options.find((f) => f.name === foodName);
  if (!food) return outcome(state, { note: "这个不在今天的食谱里～" });
  if (food.name === state.want.name) {
    return outcome({ ...state, bowl: food.name, done: true }, {
      acted: true,
      done: true,
      note: `啊呜～${food.name}正是它想要的！`
    });
  }
  return outcome(state, {
    acted: true,
    miss: true,
    note: food.liked ? `它闻了闻${food.name}，摇摇头——今天想吃的不是这个。` : `它不爱吃${food.name}，把碗推开了。`
  });
}

// ---------------------------------------------------------------------------
// ② 逗猫：逗猫棒要动起来，猫追上了才扑
// ---------------------------------------------------------------------------

export interface Vec {
  x: number;
  y: number;
}

/** 猫追逗猫棒的速度（归一化坐标：整块舞台是 1×1，每秒最多走这么远） */
export const CHASE_SPEED = 0.9;
/** 离得这么近才够得着扑 */
export const POUNCE_DIST = 0.12;
/** 兴趣攒到这个值才会扑（棒子不动就攒不起来） */
export const POUNCE_INTEREST = 0.55;
/** 棒子每挪动 1 个单位长度攒多少兴趣 */
export const INTEREST_PER_MOVE = 2.4;
/** 棒子不动时兴趣每秒掉多少 */
export const INTEREST_DECAY = 0.5;

export interface PlayState {
  toy: Vec;
  cat: Vec;
  /** 0..1，猫现在有多想扑 */
  interest: number;
  pounces: number;
  need: number;
  done: boolean;
}

export function buildPlay(need: number, toy: Vec = { x: 0.8, y: 0.3 }, cat: Vec = { x: 0.3, y: 0.6 }): PlayState {
  return { toy: { ...toy }, cat: { ...cat }, interest: 0, pounces: 0, need: Math.max(1, Math.floor(need)), done: false };
}

function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 推进一帧：棒子挪到 `toy`，猫朝棒子走一步，兴趣按棒子的移动量涨、按时间掉。
 * 猫追上了（够近）而且兴趣够高，才算扑到一次。
 * 棒子举着不动，猫会慢慢失去兴趣——这就是逗猫和「点 N 下」的区别。
 */
export function playStep(state: PlayState, toy: Vec, dtMs: number): TaskOutcome<PlayState> {
  if (state.done) return outcome(state, { done: true });
  const dt = Math.max(0, Math.min(0.2, dtMs / 1000));
  const moved = dist(state.toy, toy);
  const interest = Math.max(0, Math.min(1, state.interest + moved * INTEREST_PER_MOVE - INTEREST_DECAY * dt));
  const gap = dist(state.cat, toy);
  const step = CHASE_SPEED * dt;
  const cat: Vec =
    gap <= step || gap === 0
      ? { ...toy }
      : { x: state.cat.x + ((toy.x - state.cat.x) / gap) * step, y: state.cat.y + ((toy.y - state.cat.y) / gap) * step };
  const next: PlayState = { ...state, toy: { ...toy }, cat, interest };
  if (dist(cat, toy) <= POUNCE_DIST && interest >= POUNCE_INTEREST) {
    const pounces = state.pounces + 1;
    const done = pounces >= state.need;
    return outcome(
      { ...next, pounces, interest: 0, done },
      {
        acted: true,
        done,
        note: done ? "玩累啦，它满足地趴下了！" : `扑到啦！还差 ${state.need - pounces} 次`
      }
    );
  }
  return outcome(next);
}

/** 兴趣条上的一句提示：棒子停太久就提醒孩子晃一晃 */
export function chaseHint(state: PlayState): string {
  if (state.interest < 0.2) return "把逗猫棒晃起来，它才追得起劲～";
  if (state.interest < POUNCE_INTEREST) return "它盯上啦，再逗一会儿！";
  return "它要扑了，把棒子停在它够得着的地方！";
}

// ---------------------------------------------------------------------------
// ③ 洗澡：画圈搓泡泡，覆盖率够了才算洗干净
// ---------------------------------------------------------------------------

export const WASH_COLS = 6;
export const WASH_ROWS = 6;
/** 搓到这个覆盖率就算洗干净（1.2 规格：≥ 90%） */
export const WASH_TARGET = 0.9;
/** 手指画一圈的笔刷半径（归一化：整块搓澡区是 1×1） */
export const SCRUB_RADIUS = 0.16;

export interface WashState {
  cols: number;
  rows: number;
  /** 每一格搓过没有 */
  cells: boolean[];
  done: boolean;
}

export function buildWash(cols = WASH_COLS, rows = WASH_ROWS): WashState {
  const c = Math.max(1, Math.floor(cols));
  const r = Math.max(1, Math.floor(rows));
  return { cols: c, rows: r, cells: new Array<boolean>(c * r).fill(false), done: false };
}

/** 已经搓掉的比例 */
export function washCoverage(state: WashState): number {
  if (state.cells.length === 0) return 1;
  return state.cells.filter(Boolean).length / state.cells.length;
}

/** 每一格的中心点（归一化坐标） */
export function washCellCenter(state: WashState, index: number): Vec {
  const col = index % state.cols;
  const row = Math.floor(index / state.cols);
  return { x: (col + 0.5) / state.cols, y: (row + 0.5) / state.rows };
}

/**
 * 键盘 / 无指针环境的兜底要搓哪一格：从 `from` 起往后找**第一个还没搓过的**，
 * 找到末尾就绕回开头。全搓完了返回 −1。
 *
 * 早先的兜底是「每点一下 `auto += 2`，再夹到最后一格」——步进 2 只碰得到一半格子，
 * `auto` 越过末格之后每一下都在重复搓同一格，覆盖率封顶在 53% 再也上不去。
 * 认「还没搓过」而不是认下标，才保证每点一下都真的有进展。
 */
export function nextWashCell(state: WashState, from = 0): number {
  const n = state.cells.length;
  if (n === 0) return -1;
  const start = ((Math.floor(from) % n) + n) % n;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (!state.cells[i]) return i;
  }
  return -1;
}

/**
 * 在 (u, v) 处画一下：笔刷半径内的格子全部算搓过。
 * 覆盖率到 `WASH_TARGET` 就完成——不用一格一格点，画圈就行。
 */
export function scrub(state: WashState, u: number, v: number, radius = SCRUB_RADIUS): TaskOutcome<WashState> {
  if (state.done) return outcome(state, { done: true });
  const cells = state.cells.slice();
  let fresh = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]) continue;
    const c = washCellCenter(state, i);
    if (Math.hypot(c.x - u, c.y - v) <= radius) {
      cells[i] = true;
      fresh++;
    }
  }
  const next: WashState = { ...state, cells };
  const cover = washCoverage(next);
  if (cover >= WASH_TARGET) {
    return outcome({ ...next, done: true }, { acted: true, done: true, note: "洗得香喷喷，毛都蓬起来啦！" });
  }
  return outcome(next, {
    acted: fresh > 0,
    note: `搓得真细致～已经洗掉 ${Math.round(cover * 100)}%`
  });
}

// ---------------------------------------------------------------------------
// ④ 哄睡：踩着节拍点音符
// ---------------------------------------------------------------------------

/** 节拍窗口：偏离超过这么多毫秒就不算踩上（前后都算） */
export const BEAT_WINDOW_MS = 220;
/** 摇篮曲默认一拍多久 */
export const BEAT_MS = 900;

export type BeatJudge = "good" | "early" | "late" | "none";

export interface SleepState {
  /** 每一拍应该在第几毫秒（相对开始） */
  beats: number[];
  /** 每一拍踩上了没有 */
  hit: boolean[];
  beatMs: number;
  done: boolean;
}

export function buildSleep(notes: number, beatMs = BEAT_MS): SleepState {
  const n = Math.max(1, Math.floor(notes));
  const step = Math.max(200, Math.floor(beatMs));
  return {
    beats: Array.from({ length: n }, (_, i) => step * (i + 1)),
    hit: new Array<boolean>(n).fill(false),
    beatMs: step,
    done: false
  };
}

/**
 * 这一下点在哪一拍上：找还没踩过的、离得最近的那一拍。
 * 在窗口内是 `good`，早了是 `early`，晚了是 `late`，一拍都没有就是 `none`。
 */
export function judgeBeat(state: SleepState, tapMs: number, window = BEAT_WINDOW_MS): { index: number; judge: BeatJudge } {
  let index = -1;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < state.beats.length; i++) {
    if (state.hit[i]) continue;
    const d = Math.abs(state.beats[i] - tapMs);
    if (d < best) {
      best = d;
      index = i;
    }
  }
  if (index < 0) return { index: -1, judge: "none" };
  if (best <= window) return { index, judge: "good" };
  return { index, judge: tapMs < state.beats[index] ? "early" : "late" };
}

/**
 * 点一下音符。踩上了这一拍就亮起来；没踩上**不扣任何东西**，
 * 摇篮曲继续放，下一拍再来——哄睡不该有惩罚。
 */
export function sleepTap(state: SleepState, tapMs: number, window = BEAT_WINDOW_MS): TaskOutcome<SleepState> {
  if (state.done) return outcome(state, { done: true });
  const { index, judge } = judgeBeat(state, tapMs, window);
  if (judge !== "good") {
    return outcome(state, {
      note: judge === "early" ? "早了一点点，等音符亮起来再点～" : "慢了半拍，跟着灯的节奏来～"
    });
  }
  const hit = state.hit.slice();
  hit[index] = true;
  const done = hit.every(Boolean);
  return outcome(
    { ...state, hit, done },
    {
      acted: true,
      done,
      note: done ? "呼噜呼噜～它睡着啦" : `踩上啦！${hit.filter(Boolean).length}/${hit.length}`
    }
  );
}

// ---------------------------------------------------------------------------
// ⑤ 打扮：把配饰拖到吸附点
// ---------------------------------------------------------------------------

/** 吸附点热区半径：直径 96px，远远超过 1.2 要求的 48px */
export const SNAP_RADIUS = 48;

export interface AccItem {
  id: string;
  emoji: string;
  name: string;
  /** 该戴在哪个吸附点上 */
  spot: string;
  /** 猫身上对应的 SVG 分组类名 */
  cls: string;
}

/** 四件配饰，各有各的位置（拖错位置只是滑下来，不算错） */
export const ACCS: readonly AccItem[] = [
  { id: "bow", emoji: "🎀", name: "蝴蝶结", spot: "head", cls: "ktc-acc-bow" },
  { id: "hat", emoji: "🎩", name: "小帽子", spot: "head", cls: "ktc-acc-hat" },
  { id: "tie", emoji: "👔", name: "领结", spot: "neck", cls: "ktc-acc-tie" },
  { id: "scarf", emoji: "🧣", name: "围巾", spot: "neck", cls: "ktc-acc-scarf" }
];

export interface SnapPoint {
  id: string;
  label: string;
  /** 吸附点在舞台里的像素坐标（由渲染层量出来喂进来） */
  x: number;
  y: number;
}

/** 离 (x, y) 最近、且在热区内的吸附点；都够不着就返回 null */
export function nearestSnap(points: readonly SnapPoint[], x: number, y: number, radius = SNAP_RADIUS): SnapPoint | null {
  let best: SnapPoint | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of points) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > radius) continue;
    if (d < bestDist - 1e-9) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

export interface DressState {
  /** 今天要戴的那一件 */
  want: AccItem;
  options: AccItem[];
  /** 已经戴上的配饰 id */
  worn: string | null;
  done: boolean;
}

export function buildDress(seed: number, optionCount: number): DressState {
  const n = Math.max(2, Math.min(ACCS.length, Math.floor(optionCount)));
  const rand = mulberry32(seed);
  const want = ACCS[Math.floor(rand() * ACCS.length)];
  const others = shuffled(
    ACCS.filter((a) => a.id !== want.id),
    mulberry32(seed * 23 + 11)
  ).slice(0, n - 1);
  return { want, options: shuffled([want, ...others], mulberry32(seed * 37 + 3)), worn: null, done: false };
}

/**
 * 把配饰松手放下。`spotId` 是渲染层用 `nearestSnap()` 算出来的吸附点，
 * 没吸上任何点就传 null——那只是滑下来了，什么都不算。
 */
export function dressDrop(state: DressState, accId: string, spotId: string | null): TaskOutcome<DressState> {
  if (state.done) return outcome(state, { done: true });
  const acc = state.options.find((a) => a.id === accId);
  if (!acc) return outcome(state, { note: "这件不在今天的衣柜里～" });
  if (!spotId) return outcome(state, { note: "松手的位置离吸附点有点远，再靠近一点～" });
  if (spotId !== acc.spot) {
    return outcome(state, { acted: true, note: `${acc.name}挂不到这里，试试它该待的地方～` });
  }
  if (acc.id !== state.want.id) {
    return outcome(state, { acted: true, miss: true, note: `它歪歪头——今天想戴的不是${acc.name}。` });
  }
  return outcome({ ...state, worn: acc.id, done: true }, {
    acted: true,
    done: true,
    note: `${acc.name}戴好啦，转个圈给你看！`
  });
}

// ---------------------------------------------------------------------------
// ⑥ 看病：先观察，再照料；每一步都能回退
// ---------------------------------------------------------------------------

export interface CureState {
  round: CureRound;
  /** 现在走到第几步（0 基） */
  step: number;
  /** 已经做过的步骤名（回退时从这里弹出来） */
  picks: string[];
  done: boolean;
}

export function cureStart(round: CureRound): CureState {
  return { round, step: 0, picks: [], done: false };
}

/** 这一步该做的是「先看一看」还是「动手照顾」（只提示类型，不直接报名字） */
export function cureStepKind(state: CureState): CureTool["kind"] | null {
  const step = state.round.steps[state.step];
  return step ? step.answer.kind : null;
}

/** 提示条：只说这一步该干哪一类事，不泄露具体是哪一件 */
export function cureHint(state: CureState): string {
  const kind = cureStepKind(state);
  if (kind === "check") return "先别急着动手——挑一样「看一看」，弄清楚是怎么回事。";
  if (kind === "care") return "看清楚啦，挑一件温柔的日常照顾。";
  return "";
}

/** 选一样东西。选对进下一步；选错停在原地给一句提示，随时可以回退重来。 */
export function curePick(state: CureState, toolName: string): TaskOutcome<CureState> {
  if (state.done) return outcome(state, { done: true });
  const cur = state.round.steps[state.step];
  if (!cur) return outcome(state, { done: true });
  if (toolName === cur.answer.name) {
    const step = state.step + 1;
    const done = step >= state.round.steps.length;
    return outcome({ ...state, step, picks: [...state.picks, toolName], done }, {
      acted: true,
      done,
      note: done ? "护理做完啦，它舒服多了！" : `第 ${step} 步做好了，接着来～`
    });
  }
  const wrong = CURE_TOOLS.find((t) => t.name === toolName);
  return outcome(state, {
    acted: true,
    miss: true,
    note: wrong && wrong.kind !== cur.answer.kind
      ? cur.answer.kind === "check"
        ? "先看一看再动手，顺序反了它会紧张～"
        : "已经看清楚啦，这一步该动手照顾了～"
      : "这一样这一步还用不上，换一个试试～"
  });
}

/**
 * 护理台屏幕上那一行字。
 *
 * 护理台每动一下都要整块重画，重画时会把「这一步该做哪一类事」的通用提示写上去；
 * 如果直接这么写，刚刚那句针对性的话（比如「先看一看再动手，顺序反了它会紧张～」）
 * 会在同一个 tick 里被盖掉，孩子一个字都看不到。所以这里统一收口：
 *
 * - 做岔了：**只留那句针对性的**，通用提示这一下让位；
 * - 做对了：把「第 N 步做好了」和下一步的类型提示接起来一起给；
 * - 没有新话要说：照旧给通用提示。
 */
export function cureMessage(note: string | undefined, hint: string, miss = false): string {
  const n = (note ?? "").trim();
  const h = (hint ?? "").trim();
  if (!n) return h;
  if (miss || !h) return n;
  return `${n}${h}`;
}

/** 回退一步：把上一步撤销，重新选（回到第 0 步就没得退了，什么也不发生） */
export function cureBack(state: CureState): TaskOutcome<CureState> {
  if (state.step <= 0) return outcome(state, { note: "已经在第一步啦，从这里开始就好～" });
  const picks = state.picks.slice(0, -1);
  return outcome({ ...state, step: state.step - 1, picks, done: false }, {
    acted: true,
    note: `退回第 ${state.step} 步，重新想一想～`
  });
}

/** 护理单：做过的照原样列出来，还没做的只留一个占位，不提前泄题 */
export function curePlan(state: CureState): Array<{ index: number; text: string; state: "done" | "now" | "todo" }> {
  return state.round.steps.map((step, i) => {
    if (i < state.step) return { index: i, text: `${step.answer.emoji} ${step.answer.name}`, state: "done" as const };
    if (i === state.step) {
      return {
        index: i,
        text: step.answer.kind === "check" ? "❓ 先看一看" : "❓ 动手照顾",
        state: "now" as const
      };
    }
    return { index: i, text: "· · ·", state: "todo" as const };
  });
}

// ---------------------------------------------------------------------------
// ⑦ 搭配：按写死的规则表评分，逐条讲理由
// ---------------------------------------------------------------------------

export interface StyleRule {
  /** 命中一个 +1 分（一件最多 +2） */
  plus: readonly string[];
  /** 命中就 −1 分（一件最多扣 1 分，不会越扣越深） */
  minus: readonly string[];
}

/**
 * 评分规则表：主题词 → 加分标签 / 减分标签。
 * 这张表是**唯一的评分依据**，屏幕上给出的每一条理由都能在这里找到出处。
 */
export const STYLE_RULES: Record<StyleTheme, StyleRule> = {
  夏日海边: { plus: ["清凉", "沙滩"], minus: ["保暖", "厚实"] },
  冬日雪天: { plus: ["保暖", "厚实"], minus: ["清凉", "沙滩"] },
  生日派对: { plus: ["闪亮", "热闹"], minus: ["耐脏", "厚实"] },
  森林野餐: { plus: ["轻便", "耐脏"], minus: ["闪亮", "厚实"] },
  星空晚会: { plus: ["闪亮", "夜色"], minus: ["沙滩", "耐脏"] }
};

/** 一件搭配的评分明细 */
export interface StyleReason {
  name: string;
  emoji: string;
  delta: number;
  /** 为什么加分 / 为什么减分，一句话说清 */
  reason: string;
}

/** 一件搭配得几分、为什么（纯函数，规则全在 `STYLE_RULES` 里） */
export function judgeStyleItem(item: StyleItem, theme: StyleTheme): StyleReason {
  const rule = STYLE_RULES[theme];
  const tags = item.tags ?? [];
  if (tags.length === 0) {
    return { name: item.name, emoji: item.emoji, delta: 1, reason: `百搭款，配什么主题都稳当 +1` };
  }
  const plus = tags.filter((t) => rule.plus.includes(t));
  const minus = tags.filter((t) => rule.minus.includes(t));
  const delta = Math.max(-1, Math.min(2, plus.length - (minus.length > 0 ? 1 : 0)));
  const parts: string[] = [];
  if (plus.length > 0) parts.push(`「${plus.join("」「")}」正对${theme} +${plus.length}`);
  if (minus.length > 0) parts.push(`「${minus.join("」「")}」跟${theme}不搭 −1`);
  if (parts.length === 0) parts.push(`「${tags.join("」「")}」跟${theme}没关系，不加也不减`);
  return { name: item.name, emoji: item.emoji, delta, reason: parts.join("，") };
}

export interface OutfitScore {
  total: number;
  max: number;
  lines: StyleReason[];
  stars: 1 | 2 | 3;
  label: string;
}

/** 一整套的评分：逐件算、逐条给理由，最后给一个只夸不批评的档位 */
export function scoreOutfit(picks: readonly StyleItem[], theme: StyleTheme): OutfitScore {
  const lines = picks.map((item) => judgeStyleItem(item, theme));
  const total = lines.reduce((s, l) => s + l.delta, 0);
  const max = picks.length * 2;
  const grade = styleGrade(Math.max(0, total), max);
  return { total, max, lines, stars: grade.stars, label: grade.label };
}

/** 搭配任务固定挑三件（1.2 规格），关卡数据要得更多就照它来 */
export const STYLE_PICKS = 3;

export function styleSlotCount(want: number | undefined): number {
  return Math.max(STYLE_PICKS, Math.min(4, Math.floor(want ?? STYLE_PICKS)));
}
