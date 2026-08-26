/**
 * 花色接龙 · 188 关关卡表(8 章,章节和恒等 188)。
 *
 * 每一关都是**残局**:牌型范围、人数、对手档位、起手张数和**牌堆顺序**全都写死,
 * 同一关每次进去发到的牌一模一样。关卡参数不是拍脑袋定的:
 * `buildLevel()` 会拿一套参考打法把这一关真的打一遍,打赢了才采用这个种子,
 * 「N 步内出完」的 N 也是照参考打法实际用的手数留出余量算的 —— 所以 188 关全部可解,
 * `levels.test.ts` 会把 188 关整个回放一遍来兜底。
 */
import { TOTAL_LEVELS, chapterOf, chapterStart, rateBelow, type Chapter } from "../level99";
import type { AiTier } from "./ai";
import { buildDeck, shuffle, type Card, type CardKind } from "./deck";
import { firstLeadScore, simulateGame, simulateMatch } from "./sim";

export const CHAPTERS: Chapter[] = [
  { name: "对上颜色", emoji: "🎨", color: "#FFE1EE", desc: "只有数字牌:颜色一样、或者数字一样就能出", size: 24 },
  { name: "跳过与反转", emoji: "🔁", color: "#FFF0CC", desc: "跳过让下一家歇一手,反转在两人局等于跳过", size: 24 },
  { name: "加二链", emoji: "➕", color: "#D9F2E4", desc: "加二可以叠加二,接不上的人一次抽完整条链", size: 24 },
  { name: "换个颜色", emoji: "🌈", color: "#DCEBFF", desc: "万能换色随时能出,出完自己挑一个新颜色", size: 24 },
  { name: "加四与质疑", emoji: "🔍", color: "#EDE2FF", desc: "手上没有当前色才该打加四,打了会被质疑", size: 22 },
  { name: "就一张", emoji: "☝️", color: "#FFE6D6", desc: "剩最后一张要按「就一张」,忘了会被点破罚抽 2", size: 22 },
  { name: "四人桌", emoji: "🪑", color: "#E2F4FF", desc: "完整的四人局:方向、跳过、叠加全都用得上", size: 24 },
  { name: "接龙杯", emoji: "🏆", color: "#FFE0E0", desc: "积分赛:赢一局收下别人手里的分,先到目标分", size: 24 },
];

/** 全部 108 张牌型 */
const ALL_KINDS: CardKind[] = ["num", "skip", "reverse", "draw2", "wild", "wild4"];

export interface HueLevel {
  /** 0 基关号 */
  index: number;
  chapter: number;
  /** 座位 0 是玩家,后面是 AI */
  players: number;
  tiers: AiTier[];
  /** 本关牌堆里出现哪些牌型 */
  kinds: CardKind[];
  handSize: number;
  seed: number;
  /** 出完手牌最多允许走几手(出牌与抽牌都算一手);积分赛不限手数 */
  maxTurns: number;
  /** 积分赛的目标分;普通关没有 */
  goalScore?: number;
  hint: string;
}

interface ChapterPlan {
  kinds: CardKind[];
  players: (t: number) => number;
  tiers: (t: number) => AiTier[];
  handSize: (t: number) => number;
  /** 积分赛(第 8 章) */
  match: boolean;
  hint: string;
}

const PLANS: ChapterPlan[] = [
  {
    kinds: ["num"],
    players: () => 2,
    tiers: () => ["rookie"],
    handSize: (t) => (t < 0.4 ? 5 : t < 0.75 ? 6 : 7),
    match: false,
    hint: "颜色一样、或者数字一样就能出。接不上就点牌堆摸一张。",
  },
  {
    kinds: ["num", "skip", "reverse"],
    players: () => 2,
    tiers: (t) => [t < 0.5 ? "rookie" : "normal"],
    handSize: (t) => (t < 0.5 ? 6 : 7),
    match: false,
    hint: "跳过让下一家歇一手;两个人玩的时候,反转也等于跳过。",
  },
  {
    kinds: ["num", "skip", "reverse", "draw2"],
    players: () => 2,
    tiers: (t) => [t < 0.6 ? "normal" : "expert"],
    handSize: () => 7,
    match: false,
    hint: "被加二砸中时,手里也有加二就续上去,整摞塞给下一家。",
  },
  {
    kinds: ["num", "skip", "reverse", "draw2", "wild"],
    players: () => 2,
    tiers: (t) => [t < 0.6 ? "normal" : "expert"],
    handSize: () => 7,
    match: false,
    hint: "万能换色任何时候都能出,出完记得挑自己牌最多的那个颜色。",
  },
  {
    kinds: ALL_KINDS,
    players: () => 2,
    tiers: () => ["expert"],
    handSize: () => 7,
    match: false,
    hint: "手上还有当前颜色就先别打加四,对手一质疑,抽 4 张的是你。",
  },
  {
    kinds: ALL_KINDS,
    players: (t) => (t < 0.5 ? 2 : 3),
    tiers: (t) => (t < 0.5 ? ["expert"] : ["expert", "normal"]),
    handSize: (t) => (t < 0.5 ? 5 : 6),
    match: false,
    hint: "打到只剩一张,右下角的「就一张」要马上按,慢一步就被罚抽 2 张。",
  },
  {
    kinds: ALL_KINDS,
    players: () => 4,
    tiers: (t) => (t < 0.5 ? ["normal", "normal", "expert"] : ["expert", "expert", "hell"]),
    handSize: () => 7,
    match: false,
    hint: "四个人一桌,反转会真的调头。留一张功能牌,专门用来卡住快出完的那家。",
  },
  {
    kinds: ALL_KINDS,
    players: () => 4,
    tiers: (t) => (t < 0.5 ? ["expert", "hell", "expert"] : ["hell", "hell", "hell"]),
    handSize: () => 7,
    match: true,
    hint: "接龙杯是积分赛:赢一局就把别人手上剩的牌折成分收走,先到目标分的人赢。",
  },
];

/** 本关在所属章节里的进度 0..1 */
export function chapterProgress(index: number): number {
  const ci = chapterOf(CHAPTERS, index);
  const size = Math.max(1, CHAPTERS[ci].size);
  const inCh = index - chapterStart(CHAPTERS, ci);
  return Math.max(0, Math.min(1, inCh / Math.max(1, size - 1)));
}

/** 本关第 round 局的牌堆(顺序固定,末尾是堆顶) */
export function levelDeck(level: Pick<HueLevel, "kinds" | "seed">, round = 0): Card[] {
  const pool = buildDeck().filter((c) => level.kinds.includes(c.kind));
  return shuffle(pool, level.seed + round * 7919).cards;
}

/** 参考打法:验关卡时,玩家这个座位交给「高手」档来打 */
const REFERENCE_TIER: AiTier = "expert";

/** 试到第几个种子还没打赢就认输(实测远用不到这么多) */
const MAX_BUMPS = 40;

/** 挑到这么利索的一副牌就不再试了:参考打法这么多手内出完 */
const TURNS_ENOUGH = 14;

/** 积分赛目标分低到这个数就够用了 */
const MATCH_GOAL_ENOUGH = 80;

/** 已经有能打赢的牌之后,最多再多试几个种子 */
const ENOUGH_BUMPS = 7;

/** 积分赛的目标分抖得厉害,多挑几副牌才挑得到一个孩子坐得住的分数 */
const MATCH_ENOUGH_BUMPS = 17;

function candidate(index: number, ci: number, plan: ChapterPlan, t: number, bump: number): HueLevel {
  const handicap = bump >= 20 ? 2 : bump >= 10 ? 1 : 0;
  const tiers = bump >= 30 ? plan.tiers(t).map(() => "rookie" as AiTier) : plan.tiers(t);
  return {
    index,
    chapter: ci,
    players: plan.players(t),
    tiers,
    kinds: plan.kinds,
    handSize: Math.max(3, plan.handSize(t) - handicap),
    seed: 81000 + index * 613 + bump * 1013,
    maxTurns: 99,
    hint: plan.hint,
  };
}

const CACHE = new Map<number, HueLevel>();

/**
 * 造第 index 关(0 基)。同一关每次算出来的参数完全一样,算完就缓存。
 * 采用一个种子之前,先拿参考打法把这一关打赢一次。
 */
export function buildLevel(index: number): HueLevel {
  const idx = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(index)));
  const hit = CACHE.get(idx);
  if (hit) return hit;

  const ci = chapterOf(CHAPTERS, idx);
  const plan = PLANS[Math.max(0, Math.min(PLANS.length - 1, ci))];
  const t = chapterProgress(idx);
  // 打得赢的种子往往不止一个,再从里头挑一个「赢得最利索」的:
  // 普通关取参考打法手数最少的那副牌,积分赛取目标分最低的那一副。
  let chosen: HueLevel | null = null;
  let chosenCost = Number.POSITIVE_INFINITY;

  for (let bump = 0; bump < MAX_BUMPS; bump++) {
    const cand = candidate(idx, ci, plan, t, bump);
    const seats: AiTier[] = [REFERENCE_TIER, ...cand.tiers].slice(0, cand.players);
    if (plan.match) {
      const track = simulateMatch({
        seats,
        seed: cand.seed,
        handSize: cand.handSize,
        rounds: 8,
        deckFor: (r) => levelDeck(cand, r),
        maxSteps: 420,
      });
      const goal = firstLeadScore(track, 0);
      if (goal !== null && goal >= 20 && goal < chosenCost) {
        chosen = { ...cand, goalScore: goal, maxTurns: 0 };
        chosenCost = goal;
      }
      if (chosenCost <= MATCH_GOAL_ENOUGH) break;
    } else {
      const res = simulateGame({
        seats,
        seed: cand.seed,
        deck: levelDeck(cand, 0),
        handSize: cand.handSize,
        maxSteps: 420,
      });
      if (res.winner === 0 && !res.stalled && res.actions[0] < chosenCost) {
        chosen = { ...cand, maxTurns: Math.max(16, res.actions[0] + 8) };
        chosenCost = res.actions[0];
      }
      if (chosenCost <= TURNS_ENOUGH) break;
    }
    // 已经有能打赢的牌了就别再挑了,免得关卡表算起来太慢
    if (chosen && bump >= (plan.match ? MATCH_ENOUGH_BUMPS : ENOUGH_BUMPS)) break;
  }

  const level = chosen ?? { ...candidate(idx, ci, plan, t, 0), maxTurns: 60 };
  CACHE.set(idx, level);
  return level;
}

/** 关卡目标的一句话 */
export function levelBrief(level: HueLevel): string {
  if (level.goalScore) return `积分赛 · 先拿到 ${level.goalScore} 分`;
  return `${level.players} 人局 · ${level.maxTurns} 手之内出完手牌`;
}

/** 评星:出完得越快星越多 */
export function levelStars(level: HueLevel, used: number): 1 | 2 | 3 {
  const limit = Math.max(4, level.maxTurns);
  return rateBelow(used, Math.round(limit * 0.55), Math.round(limit * 0.8));
}

/** 积分赛评星:用的局数越少星越多 */
export function matchStars(rounds: number): 1 | 2 | 3 {
  return rateBelow(rounds, 2, 4);
}

/** 过关时的一句夸奖 */
export function winLine(level: HueLevel, stars: number): string {
  if (level.goalScore) {
    return stars >= 3 ? "两局就把杯子端走了,这手气配得上这脑子!" : "接龙杯到手,分数一分不少地收进来了。";
  }
  if (stars >= 3) return "一手废牌都没打,干干净净出完!";
  if (stars === 2) return "顺序理得不错,再省两手就是满星。";
  return "出完啦!下次先把同色的连成一串,能少摸好几张。";
}

/** 失败时的一句鼓励,只鼓励不批评 */
export function loseLine(left: number): string {
  if (left <= 1) return "差一张就出完啦,下一局先攒个万能牌。";
  if (left <= 3) return `就剩 ${left} 张,已经很接近了,再来一次准能收尾。`;
  return "这一局牌不太顺,换个顺序试试,先把最多的那个颜色打掉。";
}

// ---------------------------------------------------------------------------
// 无尽 / 对战 的每一轮配置
// ---------------------------------------------------------------------------

export interface RoundConfig {
  players: number;
  tiers: AiTier[];
  kinds: CardKind[];
  handSize: number;
  seed: number;
  /** 这一轮的说明 */
  hint: string;
}

/** 无尽连胜:连胜越多,对手档位越硬,人数也会加到 4 个 */
export function buildEndlessRound(streak: number): RoundConfig {
  const n = Math.max(1, Math.round(streak));
  const tier: AiTier = n <= 2 ? "rookie" : n <= 5 ? "normal" : n <= 9 ? "expert" : "hell";
  const players = n <= 3 ? 2 : n <= 7 ? 3 : 4;
  return {
    players,
    tiers: new Array(players - 1).fill(tier),
    kinds: ALL_KINDS,
    handSize: 7,
    seed: 640000 + n * 2711,
    hint: `第 ${n} 局 · 对手是「${tier === "rookie" ? "菜鸟" : tier === "normal" ? "普通" : tier === "expert" ? "高手" : "地狱"}」档 · 输一局就从头再来`,
  };
}

/** 对战 / 双人同屏:每一轮换一副牌 */
export function buildVersusRound(round: number, players: number, tier: AiTier): RoundConfig {
  const r = Math.max(1, Math.round(round));
  const seats = Math.max(2, Math.min(4, Math.round(players)));
  return {
    players: seats,
    tiers: new Array(seats - 1).fill(tier),
    kinds: ALL_KINDS,
    handSize: 7,
    seed: 770000 + r * 4523,
    hint: `第 ${r} 局`,
  };
}

/** 无尽 / 对战这一轮的牌堆 */
export function roundDeck(cfg: RoundConfig, bump = 0): Card[] {
  const pool = buildDeck().filter((c) => cfg.kinds.includes(c.kind));
  return shuffle(pool, cfg.seed + bump * 131).cards;
}
