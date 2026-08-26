/**
 * 红蓝点点 · 1.2 回合内核。
 *
 * 1.1 的红蓝点点是纯手速:点得多就赢。大人一定赢小孩,这不公平。
 * 1.2 把胜负改成「谁更准 + 更稳」——四种回合各考一样东西,而且全部是纯函数,
 * 实机(`index.ts` / `arena.ts`)和测试跑的是同一套判分。
 *
 *  ① `reaction` 反应:先「预备」再「亮」,亮灯后先点者得分,**亮之前点就扣自己一分**;
 *  ② `order`    顺序:1 → 2 → 3 按号码点,点错整轮作废;
 *  ③ `color`    颜色指令:只点指定颜色,含「不要点红色」的反向指令;
 *  ④ `count`    计数:限时内点满 N 个,**超过一个就作废**(这一条专治乱拍)。
 *
 * 两条公平性硬约束写在这里,不在界面里:
 *  · 一轮只有一份 `RoundPlan`,两侧共用;左侧位序 p 与右侧位序 n-1-p 指向同一个逻辑格子(镜像);
 *  · 抢点判定只认 `createDuel(plan, now)` 里那一个 `now()`,两侧拿不到自己的时钟。
 */

// ---------------------------------------------------------------------------
// 颜色与格子
// ---------------------------------------------------------------------------

export type TapColor = "blue" | "red" | "yellow" | "green";

/** 颜色一律配一个形状:色弱、还不认字的小朋友都能靠形状分辨 */
export const COLOR_FACE: Record<TapColor, { name: string; shape: string; hex: string }> = {
  blue: { name: "蓝", shape: "●", hex: "#4C8DF6" },
  red: { name: "红", shape: "■", hex: "#EF6070" },
  yellow: { name: "黄", shape: "▲", hex: "#EAA82E" },
  green: { name: "绿", shape: "✿", hex: "#41A96F" }
};

export const TAP_COLORS: TapColor[] = ["blue", "red", "yellow", "green"];

/** 每一侧的按钮数(2×2) */
export const SLOT_COUNT = 4;

export type Side = "left" | "right";
export const SIDES: Side[] = ["left", "right"];

/** 位序 ↔ 逻辑格子的镜像映射(自反:套两次回到原处) */
export function mirrorPos(pos: number, n: number = SLOT_COUNT): number {
  return n - 1 - pos;
}

/** 某一侧屏幕上第 pos 个按钮对应的是哪个逻辑格子 */
export function logicalSlot(side: Side, pos: number, n: number = SLOT_COUNT): number {
  return side === "left" ? pos : mirrorPos(pos, n);
}

/** 某个逻辑格子在这一侧屏幕上排第几个 */
export function slotPos(side: Side, slot: number, n: number = SLOT_COUNT): number {
  return logicalSlot(side, slot, n);
}

// ---------------------------------------------------------------------------
// 回合计划
// ---------------------------------------------------------------------------

export type RoundKind = "reaction" | "order" | "color" | "count";

export const ROUND_KINDS: RoundKind[] = ["reaction", "order", "color", "count"];

export interface RoundPlan {
  kind: RoundKind;
  /** 每个逻辑格子的颜色,两侧共用同一份 */
  slots: TapColor[];
  /** 顺序回合要按这个顺序点的逻辑格子;其它回合是空数组 */
  order: number[];
  /** 该点的逻辑格子(顺序回合等于 order,计数回合是「可以点的那些」) */
  targets: number[];
  /** 绝对不许点的逻辑格子 */
  forbidden: number[];
  /** 这一轮要点满几个 */
  need: number;
  /** 颜色回合的指令颜色 */
  commandColor: TapColor | null;
  /** 颜色回合是不是反向指令(「不要点红色」) */
  negative: boolean;
  /** 预备时长:亮灯前必须先给这么久的预备,禁止无预警闪现 */
  readyMs: number;
  /** 亮灯之后的作答窗口 */
  liveMs: number;
}

/** 预备时长下限:再快的一关也得先给这么久的「预备」,否则就是在比运气 */
export const READY_MIN_MS = 450;
/** 预备时长上限:等太久小孩子会走神 */
export const READY_MAX_MS = 1400;
/** 亮灯窗口的地板:再难也要给人做得到的时间 */
export const LIVE_FLOOR_MS = 620;

/** 随机一个「预备」时长:长短不定才防得住背节奏,但永远不短于 READY_MIN_MS */
export function readyDelay(rand: () => number): number {
  const r = Math.min(1, Math.max(0, rand()));
  return Math.round(READY_MIN_MS + r * (READY_MAX_MS - READY_MIN_MS));
}

function pickInt(rand: () => number, n: number): number {
  return Math.min(n - 1, Math.max(0, Math.floor(rand() * n)));
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = pickInt(rand, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface RoundOptions {
  /** 亮灯之后的作答窗口(会被压到 LIVE_FLOOR_MS 以上) */
  liveMs?: number;
  /** 顺序回合的链长(2..4) */
  chain?: number;
  /** 计数回合要点满几个(1..3) */
  need?: number;
}

/**
 * 生成一轮的计划。**一轮只调用一次**,两侧共用返回的这一份,
 * 镜像是靠 `logicalSlot` 把左右两侧的位序映到同一批逻辑格子实现的。
 */
export function buildRound(kind: RoundKind, rand: () => number, opts: RoundOptions = {}): RoundPlan {
  const n = SLOT_COUNT;
  const live = Math.max(LIVE_FLOOR_MS, Math.round(opts.liveMs ?? 1600));
  const readyMs = readyDelay(rand);
  const all = Array.from({ length: n }, (_, i) => i);

  if (kind === "reaction") {
    const slots = all.map(() => "blue" as TapColor);
    const lit = pickInt(rand, n);
    slots[lit] = "yellow";
    return {
      kind,
      slots,
      order: [],
      targets: [lit],
      forbidden: all.filter((i) => i !== lit),
      need: 1,
      commandColor: null,
      negative: false,
      readyMs,
      liveMs: live
    };
  }

  if (kind === "order") {
    const chain = Math.max(2, Math.min(n, Math.round(opts.chain ?? 3)));
    const order = shuffle(all, rand).slice(0, chain);
    const slots = all.map((i) => (order.includes(i) ? "blue" : "green")) as TapColor[];
    return {
      kind,
      slots,
      order,
      targets: order.slice(),
      forbidden: all.filter((i) => !order.includes(i)),
      need: chain,
      commandColor: null,
      negative: false,
      readyMs,
      liveMs: live + (chain - 1) * 420
    };
  }

  if (kind === "color") {
    const command = TAP_COLORS[pickInt(rand, TAP_COLORS.length)];
    const other = TAP_COLORS.filter((c) => c !== command);
    // 指令色占 1..3 格,剩下的格子随机分给别的颜色,保证正反两种指令都有事情做
    const hits = 1 + pickInt(rand, n - 1);
    const which = shuffle(all, rand).slice(0, hits);
    const slots = all.map((i) => (which.includes(i) ? command : other[pickInt(rand, other.length)]));
    const negative = rand() < 0.4;
    const targets = negative ? all.filter((i) => !which.includes(i)) : which.slice();
    const forbidden = negative ? which.slice() : all.filter((i) => !which.includes(i));
    return {
      kind,
      slots,
      order: [],
      targets: targets.sort((a, b) => a - b),
      forbidden: forbidden.sort((a, b) => a - b),
      need: targets.length,
      commandColor: command,
      negative,
      readyMs,
      liveMs: live + 320
    };
  }

  // count:四个格子都能点,但只许点满 need 个,多点一个整轮作废
  const need = Math.max(1, Math.min(n - 1, Math.round(opts.need ?? 2 + pickInt(rand, 2))));
  const slots = all.map(() => "green" as TapColor);
  return {
    kind,
    slots,
    order: [],
    targets: all.slice(),
    forbidden: [],
    need,
    commandColor: null,
    negative: false,
    readyMs,
    liveMs: live + 420
  };
}

/**
 * 指令的图形 + 文字双通道:低年级只看图标也能明白这一轮要干嘛。
 * `solo` 是一个人玩(无尽)的场合,反应回合没有对手可比,文案要跟着改。
 */
export function roundBrief(plan: RoundPlan, solo = false): { icon: string; text: string; hint: string } {
  switch (plan.kind) {
    case "reaction":
      return {
        icon: "🚦",
        text: solo ? "等它亮了再点，越快越好" : "等它亮了再点，谁先点到谁得分",
        hint: "亮之前点会被小云朵挡一下，稳住手"
      };
    case "order":
      return {
        icon: "🔢",
        text: `按 1 → ${plan.need} 的号码顺序点`,
        hint: "先把号码看全再出手，点错这一轮就过啦"
      };
    case "color": {
      const face = plan.commandColor ? COLOR_FACE[plan.commandColor] : null;
      const label = face ? `${face.shape} ${face.name}色` : "指定颜色";
      return {
        icon: "🎨",
        text: plan.negative ? `不要点 ${label}，其它的都要点` : `只点 ${label} 的`,
        hint: "看形状比看颜色更保险"
      };
    }
    default:
      return {
        icon: "🎯",
        text: `正好点 ${plan.need} 个就停手`,
        hint: "多点一个就不算啦，会克制才是高手"
      };
  }
}

/** 这一侧屏幕上要依次点的位序(顺序回合按号码,其它回合按逻辑格子号排) */
export function sideSequence(plan: RoundPlan, side: Side): number[] {
  const slots = plan.kind === "order" ? plan.order : plan.targets;
  return slots.map((s) => slotPos(side, s, plan.slots.length));
}

/**
 * 镜像断言:两侧要点的**逻辑格子**必须完全一样,而屏幕上的位序必须左右翻转。
 * 界面怎么改都行,这一条不许破——破了就是一边比另一边好点。
 */
export function isMirrored(plan: RoundPlan): boolean {
  const n = plan.slots.length;
  const left = sideSequence(plan, "left");
  const right = sideSequence(plan, "right");
  if (left.length !== right.length) return false;
  return left.every((p, i) => right[i] === mirrorPos(p, n));
}

// ---------------------------------------------------------------------------
// 防乱拍:同一按钮 60ms 去抖 + 手掌拍多个点不给分
// ---------------------------------------------------------------------------

/** 同一个按钮在这么短的时间内重复,只算一次(自动连点器与手指抖动都挡在这里) */
export const TAP_DEBOUNCE_MS = 60;
/** 同一侧在这么短的时间内碰到两个以上不同按钮,判定为「用手掌拍」 */
export const PALM_WINDOW_MS = 80;

export type GateReason = "ok" | "debounce" | "palm";

export interface GateVerdict {
  ok: boolean;
  reason: GateReason;
  /** 手掌拍时要连坐收回的那些按钮(它们刚刚才被算进分数) */
  revoke: number[];
}

export interface TapGate {
  accept(pos: number, t: number): GateVerdict;
  reset(): void;
}

/** 每一侧一个门:先过它再谈判分 */
export function createTapGate(): TapGate {
  let last = new Map<number, number>();
  let recent: Array<{ pos: number; t: number }> = [];

  return {
    accept(pos: number, t: number): GateVerdict {
      const prev = last.get(pos);
      if (prev !== undefined && t - prev < TAP_DEBOUNCE_MS) {
        return { ok: false, reason: "debounce", revoke: [] };
      }
      recent = recent.filter((r) => t - r.t < PALM_WINDOW_MS);
      const others = [...new Set(recent.filter((r) => r.pos !== pos).map((r) => r.pos))];
      last.set(pos, t);
      recent.push({ pos, t });
      if (others.length > 0) return { ok: false, reason: "palm", revoke: others };
      return { ok: true, reason: "ok", revoke: [] };
    },
    reset() {
      last = new Map();
      recent = [];
    }
  };
}

// ---------------------------------------------------------------------------
// 一轮对局:两侧共用一份计划、一个时钟
// ---------------------------------------------------------------------------

export type TapOutcome =
  | "ignored" // 这一轮对这一侧已经结束了
  | "debounce" // 60ms 内的重复输入
  | "palm" // 手掌拍
  | "early" // 抢点:亮灯之前就点了
  | "repeat" // 这个格子刚才已经点过
  | "good" // 点对一个,还没点完
  | "win" // 这一轮拿下
  | "wrong"; // 点错 / 点了不许点的 / 点超了

export interface TapResult {
  outcome: TapOutcome;
  side: Side;
  /** 屏幕位序 */
  pos: number;
  /** 逻辑格子 */
  slot: number;
  /** 判定用的时间戳(来自对局唯一的时钟) */
  t: number;
  /** 这一下带来的分数变化 */
  delta: number;
}

export interface SideState {
  /** 已经点中的逻辑格子,按点下去的先后 */
  hits: number[];
  /** 本轮累计分数变化(抢点是负的) */
  score: number;
  /** 本轮这一侧已经出局(点错 / 抢点 / 点超) */
  out: boolean;
  /** 本轮这一侧已经完成 */
  done: boolean;
  /** 完成时的时间戳,用来比谁先 */
  finishedAt: number | null;
}

export interface RoundResult {
  /** 两侧各自的分数变化 */
  delta: Record<Side, number>;
  /** 先完成的一侧;都没完成就是 null */
  winner: Side | null;
}

export interface Duel {
  readonly plan: RoundPlan;
  /** 亮灯的绝对时刻,两侧共用同一个数 */
  readonly lightAt: number;
  /** 作答窗口关闭的绝对时刻 */
  readonly closeAt: number;
  /** 点一下。时间戳由对局自己从唯一时钟取,两侧都塞不进自己的表 */
  tap(side: Side, pos: number): TapResult;
  state(side: Side): Readonly<SideState>;
  /** 两侧都收工(完成或出局)了吗 */
  settled(): boolean;
  /** 结算:窗口到点或双方收工时调用,幂等 */
  finish(): RoundResult;
}

function emptySide(): SideState {
  return { hits: [], score: 0, out: false, done: false, finishedAt: null };
}

/**
 * 开一轮对局。`now` 是**唯一时钟源**:两侧的抢点判定都用它盖时间戳,
 * 谁也没有机会传一个自己的时间进来。
 */
export function createDuel(plan: RoundPlan, now: () => number, sides: Side[] = SIDES): Duel {
  const startedAt = now();
  const lightAt = startedAt + plan.readyMs;
  const closeAt = lightAt + plan.liveMs;
  const states = new Map<Side, SideState>(sides.map((s) => [s, emptySide()]));
  const gates = new Map<Side, TapGate>(sides.map((s) => [s, createTapGate()]));
  let finished: RoundResult | null = null;
  let winner: Side | null = null;

  function stateOf(side: Side): SideState {
    let st = states.get(side);
    if (!st) {
      st = emptySide();
      states.set(side, st);
      gates.set(side, createTapGate());
    }
    return st;
  }

  function result(side: Side, pos: number, slot: number, t: number, outcome: TapOutcome, delta: number): TapResult {
    return { outcome, side, pos, slot, t, delta };
  }

  function judge(side: Side, st: SideState, slot: number, t: number): { outcome: TapOutcome; delta: number } {
    if (plan.forbidden.includes(slot)) {
      st.out = true;
      return { outcome: "wrong", delta: 0 };
    }
    if (st.hits.includes(slot)) return { outcome: "repeat", delta: 0 };

    if (plan.kind === "order") {
      const want = plan.order[st.hits.length];
      if (slot !== want) {
        st.out = true;
        return { outcome: "wrong", delta: 0 };
      }
    }

    st.hits.push(slot);

    if (plan.kind === "count") {
      if (st.hits.length > plan.need) {
        st.out = true;
        return { outcome: "wrong", delta: 0 };
      }
      // 计数回合不比谁快,窗口关了才知道有没有点得刚刚好
      return { outcome: "good", delta: 0 };
    }

    if (st.hits.length >= plan.need) {
      st.done = true;
      st.finishedAt = t;
      if (winner === null) {
        winner = side;
        st.score += 1;
        return { outcome: "win", delta: 1 };
      }
      return { outcome: "win", delta: 0 };
    }
    return { outcome: "good", delta: 0 };
  }

  return {
    plan,
    lightAt,
    closeAt,
    tap(side: Side, pos: number): TapResult {
      const t = now();
      const slot = logicalSlot(side, pos, plan.slots.length);
      const st = stateOf(side);
      // 已经收工的一侧照样要过门:一巴掌拍下去时,连刚刚拿到手的那一分也得撤回来
      if (finished || st.out) return result(side, pos, slot, t, "ignored", 0);

      const gate = gates.get(side)!;
      const verdict = gate.accept(pos, t);
      if (verdict.reason === "debounce") return result(side, pos, slot, t, "debounce", 0);
      if (verdict.reason === "palm") {
        // 一巴掌拍下去:这一下不算,这一轮刚拿到的分也一起收回。
        // 反应回合里一巴掌盖住四个格子照样能压中目标,所以「赢了」也要能撤回来,
        // 不然「用手掌拍多个点不给分」就只是一句空话。
        const back = Math.max(0, st.score);
        st.score -= back;
        st.hits = [];
        st.done = false;
        st.finishedAt = null;
        st.out = true;
        if (winner === side) winner = null;
        return result(side, pos, slot, t, "palm", -back);
      }

      if (st.done) return result(side, pos, slot, t, "ignored", 0);

      if (t < lightAt) {
        // 抢点:亮之前点,扣自己一分,这一轮也不用再点了
        st.out = true;
        st.score -= 1;
        return result(side, pos, slot, t, "early", -1);
      }
      if (t > closeAt) {
        st.out = true;
        return result(side, pos, slot, t, "ignored", 0);
      }

      const { outcome, delta } = judge(side, st, slot, t);
      return result(side, pos, slot, t, outcome, delta);
    },
    state(side: Side) {
      return stateOf(side);
    },
    settled(): boolean {
      if (finished) return true;
      // 计数回合必须等窗口关,不然「点满了还想再点」就抓不到了
      if (plan.kind === "count") return sides.every((s) => stateOf(s).out);
      return sides.every((s) => {
        const st = stateOf(s);
        return st.out || st.done;
      });
    },
    finish(): RoundResult {
      if (finished) return finished;
      const delta = {} as Record<Side, number>;
      for (const s of sides) {
        const st = stateOf(s);
        if (plan.kind === "count" && !st.out && st.hits.length === plan.need) {
          st.done = true;
          st.score += 1;
        }
        delta[s] = st.score;
      }
      for (const s of SIDES) if (!(s in delta)) delta[s] = 0;
      finished = { delta, winner };
      return finished;
    }
  };
}

// ---------------------------------------------------------------------------
// AI 对手:四档反应 + 失误率,永远不许 0ms 完美反应
// ---------------------------------------------------------------------------

export interface AiTier {
  key: string;
  name: string;
  /** 看到亮灯到手指落下的基础时间 */
  reactionMs: number;
  /** 每一轮失手的概率(看漏、点错、点超) */
  missRate: number;
}

export const AI_TIERS: AiTier[] = [
  { key: "gentle", name: "慢慢来", reactionMs: 600, missRate: 0.3 },
  { key: "steady", name: "稳稳的", reactionMs: 420, missRate: 0.2 },
  { key: "sharp", name: "机灵鬼", reactionMs: 300, missRate: 0.12 },
  { key: "ace", name: "小高手", reactionMs: 220, missRate: 0.07 }
];

/** 小电脑再快也不能快过这个数:0ms 的完美反应是欺负人 */
export const AI_MIN_REACTION_MS = 140;
/** 出手时间的抖动幅度(±22%),机器也不该每次一模一样 */
export const AI_JITTER_RATIO = 0.22;

export function aiTier(tier: number): AiTier {
  const i = Number.isFinite(tier) ? Math.max(0, Math.min(AI_TIERS.length - 1, Math.floor(tier))) : 0;
  return AI_TIERS[i];
}

/** 这一轮小电脑要花多久出手:带抖动,但永远 ≥ AI_MIN_REACTION_MS */
export function aiReactionMs(tier: number, rand: () => number): number {
  const base = aiTier(tier).reactionMs;
  const r = Math.min(1, Math.max(0, rand()));
  const jitter = (r * 2 - 1) * AI_JITTER_RATIO;
  return Math.max(AI_MIN_REACTION_MS, Math.round(base * (1 + jitter)));
}

/** 这一轮小电脑会不会失手 */
export function aiMisses(tier: number, rand: () => number): boolean {
  return rand() < aiTier(tier).missRate;
}

/** 把 1.1 关卡表里的 `aiDelayMs` 折算成四档中的一档,给闯关的失误率用 */
export function aiTierForDelay(delayMs: number): number {
  const ms = Number.isFinite(delayMs) ? delayMs : 9999;
  if (ms >= 1000) return 0;
  if (ms >= 750) return 1;
  if (ms >= 560) return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// 无尽「点到手软」:回合类型随机、节奏越来越快、失误三次结束
// ---------------------------------------------------------------------------

/** 失误几次结束 */
export const ENDLESS_MISS_LIMIT = 3;

/** 第 n 轮抽哪一种回合:四种都会来 */
export function endlessRoundKind(round: number, rand: () => number): RoundKind {
  // 头四轮按顺序过一遍,先让孩子把四种规则都认全,之后再随机
  const r = Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1;
  if (r <= ROUND_KINDS.length) return ROUND_KINDS[r - 1];
  return ROUND_KINDS[pickInt(rand, ROUND_KINDS.length)];
}

/** 第 n 轮的作答窗口:一轮比一轮短,压到地板为止 */
export function endlessLiveMs(round: number): number {
  const r = Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1;
  return Math.max(LIVE_FLOOR_MS, 1900 - (r - 1) * 34);
}

/** 第 n 轮回合之间的喘息:也会缩短,但留得住 */
export function endlessGapMs(round: number): number {
  const r = Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1;
  return Math.max(320, 760 - (r - 1) * 12);
}

/** 撑得越久,陪练的小电脑档位越高 */
export function endlessAiTier(round: number): number {
  const r = Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1;
  if (r >= 30) return 3;
  if (r >= 18) return 2;
  if (r >= 8) return 1;
  return 0;
}

/** 无尽成绩记的是「撑过几轮」,不是点了几下 */
export function endlessRounds(cleared: number): number {
  return Math.max(0, Math.floor(Number.isFinite(cleared) ? cleared : 0));
}
