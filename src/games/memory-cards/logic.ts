/**
 * 记忆翻翻乐 · 纯逻辑层。
 *
 * 1.2 第一件事就是把**发牌、翻牌状态机、配对判定、计分**从 `index.ts` 和 `levels.ts`
 * 里抽到这儿来:数值一个都没改,只是搬了家 + 补上原先散在 DOM 回调里的那几段。
 * 全是纯函数,不碰 DOM,单测可以把每一关都验算一遍。
 */
import { mulberry32, shuffled } from "../level99";
import { THEME_EMOJIS, type MemoryLevel } from "./levels";

// ---------------------------------------------------------------------------
// 一、算式配对（1.1 机制，原样搬过来）
// ---------------------------------------------------------------------------

export interface MathPair {
  expr: string;
  value: number;
}

/** 口算求值：只认「a 运算符 b」，看不懂就返回 NaN */
export function evalExpr(expr: string): number {
  const m = /^(\d+)([+\-×÷])(\d+)$/.exec(expr);
  if (!m) return NaN;
  const a = Number(m[1]);
  const b = Number(m[3]);
  switch (m[2]) {
    case "+": return a + b;
    case "-": return a - b;
    case "×": return a * b;
    default: return b === 0 ? NaN : a / b;
  }
}

/**
 * 生成 count 组「算式 + 得数」，得数两两不同——
 * 不然一张得数卡会同时配得上两张算式卡，孩子就没法判断对错了。
 * hard：0 = 二十以内加减，1 = 乘法口诀与整除，2 = 两位数加减乘除。
 */
export function buildMathPairs(seed: number, count: number, hard: number): MathPair[] {
  const rand = mulberry32(seed);
  const level = Math.max(0, Math.min(2, Math.floor(hard)));
  const out: MathPair[] = [];
  const used = new Set<number>();
  const ri = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));
  let guard = 0;
  while (out.length < Math.max(0, Math.floor(count)) && guard < 4000) {
    guard++;
    let expr = "";
    let value = 0;
    const op = level === 0 ? (rand() < 0.55 ? "+" : "-") : ["+", "-", "×", "÷"][Math.floor(rand() * 4)];
    if (op === "+") {
      const a = level === 0 ? ri(2, 9) : level === 1 ? ri(6, 29) : ri(15, 79);
      const b = level === 0 ? ri(2, 9) : level === 1 ? ri(6, 29) : ri(15, 79);
      expr = `${a}+${b}`;
      value = a + b;
    } else if (op === "-") {
      const b = level === 0 ? ri(2, 9) : level === 1 ? ri(4, 19) : ri(12, 49);
      const v = level === 0 ? ri(2, 11) : level === 1 ? ri(3, 40) : ri(10, 90);
      expr = `${v + b}-${b}`;
      value = v;
    } else if (op === "×") {
      const a = level === 1 ? ri(2, 9) : ri(3, 12);
      const b = level === 1 ? ri(2, 9) : ri(3, 12);
      expr = `${a}×${b}`;
      value = a * b;
    } else {
      const b = level === 1 ? ri(2, 9) : ri(3, 12);
      const v = level === 1 ? ri(2, 9) : ri(3, 12);
      expr = `${v * b}÷${b}`;
      value = v;
    }
    if (used.has(value)) continue;
    used.add(value);
    out.push({ expr, value });
  }
  // 极端情况下补几组最简单的，保证张数一定够（宁可简单也不能少牌）
  let fill = 1;
  while (out.length < Math.max(0, Math.floor(count))) {
    while (used.has(fill)) fill++;
    used.add(fill);
    out.push({ expr: `${fill}+0`, value: fill });
    fill++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 二、牌阵整体旋转（1.1 机制，原样搬过来）
// ---------------------------------------------------------------------------

/**
 * 把还在场上的牌整体挪一格（已经配掉的空位不参与）。
 * order[slot] = 牌号；返回新的 order，牌一张不多一张不少。
 */
export function rotatePositions(order: number[], gone: boolean[], step = 1): number[] {
  const slots: number[] = [];
  order.forEach((card, slot) => {
    if (card >= 0 && !gone[card]) slots.push(slot);
  });
  if (slots.length < 2) return order.slice();
  const next = order.slice();
  const cards = slots.map((slot) => order[slot]);
  const n = cards.length;
  const s = ((Math.round(step) % n) + n) % n;
  slots.forEach((slot, k) => {
    next[slot] = cards[(k - s + n * 2) % n];
  });
  return next;
}

// ---------------------------------------------------------------------------
// 三、发牌
// ---------------------------------------------------------------------------

export interface MemoryCard {
  /** 同一组的牌 group 相同；干扰卡的 group 独一无二 */
  group: number;
  /** 牌面（表情、算式或得数） */
  face: string;
  /** 没有同伴的独苗卡 */
  decoy: boolean;
}

/** 一关要发多少张牌 */
export function deckSize(cfg: MemoryLevel): number {
  return cfg.pairs * cfg.matchSize + (cfg.decoys ?? 0);
}

/**
 * 发一副牌：算式关一张算式配一张得数，普通关同一个表情配 matchSize 张。
 * 洗牌走 level99 的 `shuffled`（Fisher–Yates，无偏）。
 */
export function buildDeck(cfg: MemoryLevel, seed: number): MemoryCard[] {
  const pool = THEME_EMOJIS[cfg.theme] ?? THEME_EMOJIS[0];
  const cards: MemoryCard[] = [];
  if (cfg.mathPairs) {
    const pairs = buildMathPairs(seed, cfg.pairs + (cfg.decoys ?? 0), cfg.mathHard ?? 0);
    pairs.slice(0, cfg.pairs).forEach((p, gi) => {
      cards.push({ group: gi, face: p.expr, decoy: false });
      cards.push({ group: gi, face: String(p.value), decoy: false });
    });
    // 干扰卡：得数对不上任何一道算式的孤零零一张
    pairs.slice(cfg.pairs).forEach((p, k) => {
      cards.push({ group: 1000 + k, face: String(p.value), decoy: true });
    });
  } else {
    for (let gi = 0; gi < cfg.pairs; gi++) {
      for (let k = 0; k < cfg.matchSize; k++) {
        cards.push({ group: gi, face: pool[gi % pool.length], decoy: false });
      }
    }
    for (let k = 0; k < (cfg.decoys ?? 0); k++) {
      cards.push({ group: 1000 + k, face: pool[(cfg.pairs + k) % pool.length], decoy: true });
    }
  }
  return shuffled(cards, mulberry32(seed * 31 + 17));
}

/** 本关发牌的随机种子：同一关每次进入的牌面一致 */
export function deckSeed(level: number): number {
  return level * 6151 + 409;
}

/**
 * 这张牌该画第几号图案：和 `buildDeck` 挑表情的规矩一模一样，
 * 所以画出来的原创图案和牌面表情永远一一对应。
 */
export function iconIndexOf(cfg: MemoryLevel, card: MemoryCard, packSize: number): number {
  const size = Math.max(1, packSize);
  if (card.decoy) return (cfg.pairs + (card.group - 1000)) % size;
  return card.group % size;
}

// ---------------------------------------------------------------------------
// 四、翻牌状态机
// ---------------------------------------------------------------------------

/**
 * 四个状态：
 * - `dealing` 开局偷看 / 还没发完，谁点都不算
 * - `idle` 一张没翻，等第一张
 * - `open` 已经翻开 1..matchSize-1 张，还差几张凑一组
 * - `resolving` 一组凑齐了，正在判定 / 播动画 —— **这时候点不出第三张**
 */
export type FlipPhase = "dealing" | "idle" | "open" | "resolving";

export interface FlipState {
  phase: FlipPhase;
  /** 一组要几张 */
  matchSize: 2 | 3;
  /** 这一轮已经翻开的牌号（按点击顺序） */
  open: number[];
  /** 动画期间收下的最后一次点击：动画一结束就替玩家补上，不吃掉这一下 */
  pending: number | null;
}

export function newFlipState(matchSize: 2 | 3, dealing = false): FlipState {
  return { phase: dealing ? "dealing" : "idle", matchSize, open: [], pending: null };
}

/** 发完牌 / 偷看结束：可以开始翻了 */
export function startPlay(s: FlipState): FlipState {
  return s.phase === "dealing" ? { ...s, phase: "idle" } : s;
}

export interface FlipInput {
  /** 点的这张牌是不是已经配掉了 */
  gone: boolean;
  /** 是不是已经翻开着（同一张点两下不算数） */
  faceUp: boolean;
}

export type FlipEffect =
  /** 什么也不做 */
  | { kind: "ignore" }
  /** 翻开这张牌 */
  | { kind: "flip"; card: number }
  /** 这一组齐了，去判定 */
  | { kind: "resolve"; card: number; group: number[] }
  /** 动画期间的点击先记下来，等结算完再补 */
  | { kind: "buffer"; card: number };

/**
 * 点了第 card 张牌会发生什么。
 * 狂点保护全在这儿：`resolving` / `dealing` 期间一律不翻新牌，
 * 但会把**最后一次**点击记进 pending，结算完立刻替玩家补上。
 */
export function tapCard(s: FlipState, card: number, input: FlipInput): { state: FlipState; effect: FlipEffect } {
  if (input.gone) return { state: s, effect: { kind: "ignore" } };
  if (s.phase === "dealing") return { state: s, effect: { kind: "ignore" } };
  if (s.phase === "resolving") {
    // 动画还没播完：不翻，但把这一下记住（只留最后一次，狂点不会攒出一串）
    return { state: { ...s, pending: card }, effect: { kind: "buffer", card } };
  }
  if (input.faceUp || s.open.includes(card)) return { state: s, effect: { kind: "ignore" } };
  const open = [...s.open, card];
  if (open.length < s.matchSize) {
    return { state: { ...s, phase: "open", open }, effect: { kind: "flip", card } };
  }
  // 凑齐一组：立刻进结算态，第三张点不出来
  return {
    state: { ...s, phase: "resolving", open: [] },
    effect: { kind: "resolve", card, group: open },
  };
}

/** 结算播完：回到空闲，并把动画期间那一下点击交还出来 */
export function settle(s: FlipState): { state: FlipState; replay: number | null } {
  const replay = s.pending;
  return { state: { ...s, phase: "idle", open: [], pending: null }, replay };
}

/** 这会儿点下去还有效吗（画面上据此把卡片调成不可点） */
export function acceptsInput(s: FlipState): boolean {
  return s.phase === "idle" || s.phase === "open";
}

// ---------------------------------------------------------------------------
// 四之二、翻转动画的时序（不碰 DOM，只算「这一帧转到几度、该露哪一面」）
// ---------------------------------------------------------------------------

/** 翻转一次要多久 */
export const FLIP_MS = 200;
/** 关掉动画效果的孩子改成淡入淡出，时长短一点 */
export const FLIP_FADE_MS = 140;

export function flipDuration(reducedMotion: boolean): number {
  return reducedMotion ? FLIP_FADE_MS : FLIP_MS;
}

export interface FlipFrame {
  /** 进度 0..1 */
  t: number;
  /** 转到几度（0 = 背面正对，180 = 正面正对） */
  deg: number;
  /** 这一帧该露正面了吗：**必须**过了 90° 才换，不然中途就露馅了 */
  showFace: boolean;
  /** 转完了没有 */
  done: boolean;
}

/**
 * 翻牌动画的第 elapsed 毫秒长什么样。
 * 盖回去（toFace = false）就是倒着放同一段动画，换面同样卡在 90° 那一帧。
 */
export function flipFrame(elapsedMs: number, durMs = FLIP_MS, toFace = true): FlipFrame {
  const dur = Math.max(1, durMs);
  const t = Math.max(0, Math.min(1, elapsedMs / dur));
  const deg = toFace ? t * 180 : 180 - t * 180;
  return { t, deg, showFace: toFace ? t >= 0.5 : t < 0.5, done: t >= 1 };
}

// ---------------------------------------------------------------------------
// 四之三、卡背花纹
// ---------------------------------------------------------------------------

/** 卡背一共几种花纹 */
export const BACK_PATTERNS = 4;

/**
 * 这个**槽位**的卡背画第几号花纹。
 * 只看槽位不看牌 —— 牌被章鱼换了位置、牌阵转了一圈，花纹都留在原地，
 * 所以背面的差别只是好看 + 干扰，绝不会把牌的身份泄出去。
 */
export function backPattern(slot: number, theme: number): number {
  const s = Math.max(0, Math.floor(slot));
  const th = Math.max(0, Math.floor(theme));
  return (s * 3 + th) % BACK_PATTERNS;
}

// ---------------------------------------------------------------------------
// 四之四、牌盘尺寸：360px 窄屏也要整盘看得见
// ---------------------------------------------------------------------------

/** 卡片最小宽 / 高（px） */
export const CARD_MIN_W = 56;
export const CARD_MIN_H = 72;

/** 牌多就把间距收紧，保证整盘不用滚动也摆得下 */
export function boardGap(cols: number, rows: number): number {
  const n = Math.max(1, cols) * Math.max(1, rows);
  if (n >= 24) return 4;
  if (n >= 16) return 6;
  return 8;
}

/** 在 width 宽的屏上，cols 列每张牌有多宽（够不够 56px 由单测盯着） */
export function cardWidthAt(width: number, cols: number, rows: number, pad = 12): number {
  const c = Math.max(1, cols);
  const gap = boardGap(c, rows);
  return Math.floor((Math.max(0, width) - pad * 2 - gap * (c - 1)) / c);
}

// ---------------------------------------------------------------------------
// 四之五、双人轮流翻（家里两个人抢着玩的那种）
// ---------------------------------------------------------------------------

export type Seat = 0 | 1;

export const SEAT_NAMES: [string, string] = ["朵朵", "星星"];

/** 配到了就接着翻，没配到才换人 */
export function nextTurn(cur: Seat, matched: boolean): Seat {
  if (matched) return cur;
  return cur === 0 ? 1 : 0;
}

/** 谁赢了：一样多就是平手（返回 null） */
export function versusWinner(scores: readonly [number, number]): Seat | null {
  if (scores[0] === scores[1]) return null;
  return scores[0] > scores[1] ? 0 : 1;
}

/** 双人收场那句话：赢的夸、平的也夸，没有一句批评 */
export function versusLine(scores: readonly [number, number]): string {
  const w = versusWinner(scores);
  if (w === null) return `${scores[0]} 比 ${scores[1]} 打成平手，两个人记性一样好，握个手再来一局！`;
  const win = SEAT_NAMES[w];
  const lose = SEAT_NAMES[w === 0 ? 1 : 0];
  return `${win} 配到 ${scores[w]} 组，${lose} 配到 ${scores[w === 0 ? 1 : 0]} 组，${win}这一局记得更牢！`;
}

// ---------------------------------------------------------------------------
// 五、配对判定
// ---------------------------------------------------------------------------

/** 这一组算配上了吗：独苗卡永远配不上，其余要 group 全一样 */
export function groupMatches(deck: readonly MemoryCard[], group: readonly number[]): boolean {
  if (group.length === 0) return false;
  const first = deck[group[0]];
  if (!first || first.decoy) return false;
  return group.every((c) => deck[c] && !deck[c].decoy && deck[c].group === first.group);
}

/** 这一组里有没有独苗卡（有就换一句「记住它，别再碰」的话） */
export function hitDecoy(deck: readonly MemoryCard[], group: readonly number[]): number | null {
  for (const c of group) if (deck[c]?.decoy) return c;
  return null;
}

// ---------------------------------------------------------------------------
// 六、计分与结算文案（数值与 1.1 完全一致）
// ---------------------------------------------------------------------------

/** 翻错越少星越多：错到 maxMiss/3 以内三星，2/3 以内两星 */
export function starsForMisses(maxMiss: number, misses: number): 1 | 2 | 3 {
  const third = Math.max(1, Math.floor(maxMiss / 3));
  if (misses <= third) return 3;
  if (misses <= third * 2) return 2;
  return 1;
}

/** 过关那句夸奖（1.1 的原话，别改坏） */
export function wonLine(misses: number, assist = false): string {
  const base = `全部配对成功，只翻错 ${misses} 次，记忆很扎实！`;
  return assist ? `${base}（这一关开着记忆辅助 🫶）` : base;
}

/** 没过关那句话：只鼓励，不批评 */
export function lostLine(timeUp: boolean): string {
  return timeUp
    ? "时间到啦～按行一张一张翻,建立顺序之后会快很多，再来一次！"
    : "机会用完啦～把「图案 + 位置」一起记成一句话，下一次命中率会高不少！";
}

// ---------------------------------------------------------------------------
// 七、记忆辅助档（关外选，开着照样能拿三星）
// ---------------------------------------------------------------------------

/** 翻错之后把刚才那几张的位置再亮这么久 */
export const ASSIST_HINT_MS = 700;

export function assistLabel(on: boolean): string {
  return on ? "🫶 记忆辅助:开" : "🫶 记忆辅助:关";
}

export function assistTip(on: boolean): string {
  return on
    ? "翻错的时候会多亮一会儿,给你时间把位置记牢;三星标准照旧。"
    : "翻错就直接盖回去。想多看一眼的话,把辅助打开就好。";
}

/** 辅助档不动三星标准，只在结算多挂一枚小徽章 */
export function assistChangesStars(): boolean {
  return false;
}

/** 翻错之后盖回去要等多久：辅助档多留一会儿给孩子记位置 */
export function coverDelayMs(matchSize: 2 | 3, assist: boolean): number {
  const base = matchSize === 3 ? 950 : 750;
  return assist ? base + ASSIST_HINT_MS : base;
}

// ---------------------------------------------------------------------------
// 八、会移动的牌：定时交换两张，换之前先预警
// ---------------------------------------------------------------------------

/** 预警提前这么久亮起来，孩子有时间把眼睛移过去 */
export const SWAP_WARN_MS = 1500;

/** 距离下一次交换还有几秒（给 HUD 用） */
export function secondsToSwap(everyMs: number, elapsedMs: number): number {
  if (everyMs <= 0) return 0;
  const left = everyMs - (Math.max(0, elapsedMs) % everyMs);
  return Math.ceil(left / 1000);
}

/** 该亮预警了吗 */
export function swapWarning(everyMs: number, elapsedMs: number, warnMs = SWAP_WARN_MS): boolean {
  if (everyMs <= 0) return false;
  const left = everyMs - (Math.max(0, elapsedMs) % everyMs);
  return left <= warnMs;
}

/**
 * 挑两张要换位置的牌：只在**扣着的**牌里挑，翻开的和配掉的都不动。
 * 挑不出两张就返回 null（这一次就不换了，绝不硬换）。
 */
export function pickSwapPair(
  candidates: readonly number[],
  rand: () => number
): [number, number] | null {
  if (candidates.length < 2) return null;
  const a = Math.min(candidates.length - 1, Math.floor(rand() * candidates.length));
  let b = Math.min(candidates.length - 1, Math.floor(rand() * candidates.length));
  if (b === a) b = (a + 1) % candidates.length;
  return [candidates[a], candidates[b]];
}

/** 真的把两个槽位对调 */
export function swapSlots(order: readonly number[], a: number, b: number): number[] {
  const out = order.slice();
  if (a < 0 || b < 0 || a >= out.length || b >= out.length) return out;
  [out[a], out[b]] = [out[b], out[a]];
  return out;
}

// ---------------------------------------------------------------------------
// 九、无尽「记忆挑战」：对数递增，错满 3 次收工
// ---------------------------------------------------------------------------

/** 错满这么多次就收工 */
export const ENDLESS_MAX_MISS = 3;

/** 牌数封顶：10 组 20 张，再多 360px 上就摆不下（5 列 × 4 行已经到底） */
export const ENDLESS_MAX_PAIRS = 10;

/** 第 round 轮（1 基）要配几组：从 3 组起步，越往后越多，封顶 10 组 */
export function endlessPairs(round: number): number {
  const n = Math.max(1, Math.round(round) || 1);
  return Math.min(ENDLESS_MAX_PAIRS, 2 + n);
}

/** 第 round 轮用第几套主题：一轮换一套，六套轮着来 */
export function endlessTheme(round: number, packs: number): number {
  const n = Math.max(1, Math.round(round) || 1);
  return (n - 1) % Math.max(1, packs);
}

/**
 * 第 round 轮的牌盘几列：牌多就多一列。
 *
 * 上限就是 5 —— 6 列时每张牌在 360px 上只剩 52px，戳不准（`CARD_MIN_W` 是 56）。
 * 原来写成 `<=15 ? 5 : 5` 的三目两个分支一模一样，读起来像是「超过 15 张还有别的排法」，
 * 实际没有；这里把它写实，并由 `qaC1` 的窄屏性质测试盯着。
 */
export const ENDLESS_MAX_COLS = 5;

export function endlessCols(pairs: number): number {
  return pairs * 2 <= 8 ? 4 : ENDLESS_MAX_COLS;
}

/** 从第几轮起牌阵开始整体转 */
export const ENDLESS_ROTATE_FROM = 16;
/** 从第几轮起单张牌开始自己挪窝 */
export const ENDLESS_SWAP_FROM = 10;

/**
 * 牌数封顶之后接着上的两样「不加牌」的机关。
 *
 * 组数第 8 轮就顶到 10 了，机关不接上的话第 8 轮和第 99 轮是同一关换个配色，
 * 剩下的只有换皮。所以封顶之后改用不占地方的机关继续往上加：
 * 先是单张牌自己挪窝（换之前有预警），再是整个牌阵按节奏转一格，
 * 两样都从慢到快，各有下限——挪得再勤也要留出「翻完一组」的时间。
 */
export function endlessTwist(round: number): { rotateEvery: number; swapEvery: number } {
  const n = Math.max(1, Math.round(round) || 1);
  // 每 2 轮快 500ms，14 秒起步，8 秒到底（和战役终极厅同一个下限）
  const swapEvery =
    n < ENDLESS_SWAP_FROM ? 0 : Math.max(8000, 14000 - Math.floor((n - ENDLESS_SWAP_FROM) / 2) * 500);
  // 每 4 轮少 1 翻，9 翻转一格起步，5 翻到底（还够翻完一组再转）
  const rotateEvery =
    n < ENDLESS_ROTATE_FROM ? 0 : Math.max(5, 9 - Math.floor((n - ENDLESS_ROTATE_FROM) / 4));
  return { rotateEvery, swapEvery };
}

/**
 * 这一轮到底有多难，越大越难（只给单测盯「曲线一路往上、不许走平」用）。
 * 组数占大头，机关按「加得多快」折算成小数往上垫。
 */
export function endlessDifficulty(round: number): number {
  const { rotateEvery, swapEvery } = endlessTwist(round);
  const swapPart = swapEvery > 0 ? 1 + (14000 - swapEvery) / 6000 : 0;
  const rotatePart = rotateEvery > 0 ? 1 + (9 - rotateEvery) / 4 : 0;
  return endlessPairs(round) * 10 + swapPart + rotatePart;
}

/** 无尽这一轮的关卡配置（复用同一套发牌与判定） */
export function endlessLevel(round: number, packs: number): MemoryLevel {
  const pairs = endlessPairs(round);
  const { rotateEvery, swapEvery } = endlessTwist(round);
  return {
    pairs,
    cols: endlessCols(pairs),
    // 无尽的失误额度由外面的「三次机会」管，这里给足，免得单关先判负
    maxMiss: 999,
    imp: 0,
    peekMs: round <= 1 ? 1600 : 0,
    matchSize: 2,
    timeLimit: 0,
    theme: endlessTheme(round, packs),
    ...(rotateEvery > 0 ? { rotateEvery } : {}),
    ...(swapEvery > 0 ? { swapEvery } : {}),
  };
}

/** 无尽成绩：一路配掉的总组数 */
export function endlessScore(pairsCleared: number): number {
  return Math.max(0, Math.round(pairsCleared));
}

/** 无尽收工那句话：只鼓励 */
export function endlessLine(pairs: number, best: number): string {
  if (pairs <= 0) return "刚坐下就起身啦~ 先把前两张记牢,后面就顺了!";
  if (pairs > best) return `新纪录!这一趟你记住了 ${pairs} 组图案!`;
  return `这一趟记住了 ${pairs} 组,最好成绩 ${best} 组,再来一次准能追上!`;
}

// ---------------------------------------------------------------------------
// 十、可解性：一个记性完美的孩子要翻多少次、错多少次
// ---------------------------------------------------------------------------

export interface PlayEstimate {
  /** 翻牌总次数 */
  flips: number;
  /** 配错的次数 */
  misses: number;
}

/**
 * 记性完美的玩法：见过的牌都记得住，
 * 先把已经认出来的一组收掉，认不出来才去翻生牌（翻岔了才算一次失误）。
 * 返回这一关最少需要几次失误——maxMiss 必须比它宽裕，这一关才算过得去。
 */
export function simulatePerfectPlay(cfg: MemoryLevel, seed: number): PlayEstimate {
  const deck = buildDeck(cfg, seed);
  const need = cfg.matchSize;
  const gone = new Array<boolean>(deck.length).fill(false);
  /** 已经翻开看过的牌（下标） */
  const known = new Set<number>();
  let flips = 0;
  let misses = 0;
  let matched = 0;

  const knownGroup = (group: number): number[] =>
    Array.from(known).filter((i) => !gone[i] && deck[i].group === group);

  const collect = (idxs: number[]): void => {
    for (const i of idxs) {
      gone[i] = true;
      known.delete(i);
    }
    matched++;
  };

  let guard = 0;
  while (matched < cfg.pairs && guard++ < 5000) {
    // ① 手上已经有凑齐的一组，直接收掉，一次都不会错
    let done = false;
    for (const i of Array.from(known)) {
      if (gone[i] || deck[i].decoy) continue;
      const same = knownGroup(deck[i].group);
      if (same.length >= need) {
        flips += need;
        collect(same.slice(0, need));
        done = true;
        break;
      }
    }
    if (done) continue;

    // ② 没有现成的，就去翻一张生牌
    const fresh = deck
      .map((_, i) => i)
      .filter((i) => !gone[i] && !known.has(i));
    if (fresh.length === 0) break;
    const first = fresh[0];
    known.add(first);
    flips++;
    // 翻出来的牌正好补齐一组，就顺手收掉
    const same = knownGroup(deck[first].group);
    if (!deck[first].decoy && same.length >= need) {
      flips += need - 1;
      collect(same.slice(0, need));
      continue;
    }
    // 补不齐：再翻一张生牌碰运气，碰不上就记一次失误
    const more = fresh.filter((i) => i !== first);
    if (more.length === 0) break;
    const second = more[0];
    known.add(second);
    flips++;
    const pair = knownGroup(deck[second].group);
    if (!deck[second].decoy && pair.length >= need) {
      flips += need - 1;
      collect(pair.slice(0, need));
    } else {
      misses++;
    }
  }
  return { flips, misses };
}

/** 按翻牌次数估一局要多久（一次翻牌 1.2 秒，配错还要等牌翻回去） */
export function estimateSeconds(est: PlayEstimate): number {
  return est.flips * 1.2 + est.misses * 0.9;
}
