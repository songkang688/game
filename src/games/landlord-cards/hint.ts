// 鸭梨抢地主 —— 牌力提示三档(1.2 新增)。
//
// 三档:
//  - off    关掉,自己想(挑战档);
//  - groups 只高亮「现在能出的牌组」,出哪一组自己决定;
//  - coach  推荐一手,并说一句**从搜索结果里读出来的**理由。
//
// 这一层的红线是「不许胡说」:理由里出现的每一个数字——看了多少种走法、
// 打完还剩几手、大牌动没动——都由本文件里同一次搜索算出来,不是写死的话术。
// 搜索本身复用困难档 AI 的候选生成与局面分,所以「教练推荐的」和「厉害档会打的」是同一套标准。
import {
  beatCandidates,
  controlScore,
  leadCandidates,
  positionScore,
  sameTeam,
  scoreChoice,
  splitCount,
  type AiContext,
} from "./ai";
import { PLAY_NAMES, cardLabel, describePlay, isBombLike, type Play } from "./logic";

export type HintMode = "off" | "groups" | "coach";

/** 三档的显示顺序:关 → 高亮 → 教练 */
export const HINT_MODES: readonly HintMode[] = ["off", "groups", "coach"];

export const HINT_MODE_NAMES: Record<HintMode, string> = {
  off: "提示:关",
  groups: "提示:高亮牌组",
  coach: "提示:推荐一手",
};

export const HINT_MODE_DESC: Record<HintMode, string> = {
  off: "挑战档:完全靠自己想,牌桌上什么都不标。",
  groups: "把现在能出的牌组都圈出来,出哪一组你自己挑。",
  coach: "推荐一手,并把「为什么是这一手」讲给你听。",
};

/** 点一下换下一档,循环 */
export function nextHintMode(mode: HintMode): HintMode {
  const i = HINT_MODES.indexOf(mode);
  return HINT_MODES[(i + 1) % HINT_MODES.length];
}

/** 搜索时给每一手牌算出来的账 */
export interface HintCandidate {
  play: Play;
  /** 局面分:越小越好(与困难档 AI 同一把尺) */
  score: number;
  /** 打完这一手之后还要几手才能走完 */
  restHands: number;
  /** 这一手打完就赢了 */
  finisher: boolean;
  /** 这一手动用了炸弹或王炸 */
  usesBomb: boolean;
  /** 打完之后大牌(2 / 王 / 炸弹)的控场分 */
  restControl: number;
}

export interface HintResult {
  mode: HintMode;
  /** 推荐的一手;null 表示「这一手建议过掉」或者这一档不给推荐 */
  play: Play | null;
  /** 建议「不要」 */
  pass: boolean;
  /** 一句从搜索结果里读出来的理由 */
  reason: string;
  /** 这次真的看过多少种走法(0 表示没搜) */
  searched: number;
  /** 按「越靠前越推荐」排好的候选,高亮档直接拿它圈牌 */
  ranked: HintCandidate[];
}

export interface HintInput {
  hand: readonly number[];
  /** 要压过的那一手;null 表示自己先手 */
  prev: Play | null;
  seat: number;
  landlord: number;
  /** 三家各剩几张 */
  counts: readonly number[];
}

/** 「不要」的门槛:和困难档 AI 用同一个口径,压得住就尽量压 */
const PASS_MARGIN = -32;

/**
 * 教练档比困难档多守一条:如果搜下来能压住的走法**全都要动炸弹**,
 * 而对手谁都还剩 3 张以上,那就先过一手。
 * 这不是拍脑袋——「全都要动炸弹」和「对手还剩几张」都是这次搜索与桌面的事实,
 * 只是给孩子的建议比 AI 自己打牌保守一点点:炸弹留到真正拦得住人的时候。
 */
const BOMB_PATIENCE_CARDS = 3;

function ctxOf(input: HintInput): AiContext {
  return {
    seat: input.seat,
    landlord: input.landlord,
    hand: input.hand.slice(),
    prev: input.prev,
    prevSeat: (input.seat + 2) % 3,
    counts: input.counts.slice(),
    // 搜索是确定性的:同样的局面永远给同一手推荐,理由也永远一致
    rand: () => 0.5,
  };
}

function without(hand: readonly number[], cards: readonly number[]): number[] {
  const drop = new Set(cards);
  return hand.filter((id) => !drop.has(id));
}

/** 现在能出的所有牌组(去重),高亮档与教练档共用同一份候选 */
export function playableGroups(hand: readonly number[], prev: Play | null): Play[] {
  const list = prev ? beatCandidates(hand, prev) : leadCandidates(hand);
  const seen = new Set<string>();
  const out: Play[] = [];
  for (const p of list) {
    const key = p.cards.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** 把候选牌组按牌型点一遍数,给高亮档写一句「有几组能出」 */
export function groupsSummary(list: readonly Play[]): string {
  if (list.length === 0) return "这一手一组都接不上,点「不要」过掉就好。";
  const byType = new Map<string, number>();
  for (const p of list) byType.set(p.type, (byType.get(p.type) ?? 0) + 1);
  const parts = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t, n]) => `${PLAY_NAMES[t as Play["type"]]} ${n} 组`);
  return `现在能出的一共 ${list.length} 组:${parts.join(" · ")}。`;
}

/** 真的把每一种走法都算一遍账,按「越小越好」排序 */
export function rankCandidates(input: HintInput): HintCandidate[] {
  const ctx = ctxOf(input);
  const list = playableGroups(input.hand, input.prev);
  const out: HintCandidate[] = list.map((play) => {
    const rest = without(input.hand, play.cards);
    return {
      play,
      score: scoreChoice(input.hand, play, ctx),
      restHands: splitCount(rest),
      finisher: rest.length === 0,
      usesBomb: isBombLike(play),
      restControl: controlScore(rest),
    };
  });
  out.sort(
    (a, b) =>
      a.score - b.score ||
      a.play.cards.length - b.play.cards.length ||
      a.play.main - b.play.main ||
      a.play.cards[0] - b.play.cards[0]
  );
  return out;
}

/** 手里最小的那张牌的写法,给「先出小单张探探路」这句话用 */
function smallestLabel(hand: readonly number[]): string {
  let best = hand[0];
  for (const id of hand) if (id < best) best = id;
  return cardLabel(best);
}

/**
 * 把搜索结果翻译成一句话。
 * 每一个数字都从 `best`(搜索选中的那一手)与 `stats` 里读,不允许出现搜索没算过的说法。
 */
export function explainChoice(
  hand: readonly number[],
  best: HintCandidate,
  searched: number,
  prev: Play | null
): string {
  const handsNow = splitCount(hand);
  const nowControl = controlScore(hand);
  if (best.finisher) {
    return `这一手 ${best.play.cards.length} 张出完手里就空了,直接把这一局收掉——看了 ${searched} 种走法,没有比这更快的。`;
  }

  const head = prev
    ? `用${describePlay(best.play)}压住上家`
    : best.play.type === "single" && best.play.cards.length === 1 && cardLabel(best.play.cards[0]) === smallestLabel(hand)
      ? `先出最小的单张${cardLabel(best.play.cards[0])}探探路`
      : `先走${describePlay(best.play)}`;

  const beats =
    best.restHands < handsNow
      ? `打完手数从 ${handsNow} 手降到 ${best.restHands} 手`
      : `打完还是 ${best.restHands} 手,但把这一块散牌清掉了`;

  const keep = best.usesBomb
    ? "这一手要动炸弹,是搜下来唯一压得住的办法"
    : best.restControl >= nowControl
      ? "2 和王一张没动,收尾的本钱都还在"
      : `大牌只让出一点点(控场分 ${nowControl} → ${best.restControl})`;

  return `${head}:${beats},${keep}。看了 ${searched} 种走法,这一手账面最划算。`;
}

/** 建议过牌时的那句话,同样只说搜索算出来的事 */
function explainPass(best: HintCandidate | undefined, searched: number): string {
  if (!best) return `这一手一种压法都搜不到,点「不要」过一手,等自己重新先手。`;
  if (best.usesBomb) {
    return `搜了 ${searched} 种压法,能压住的只有炸弹这一类。现在炸下去太亏,先过一手,把它留到对手快走完的时候。`;
  }
  return `搜了 ${searched} 种压法,最省的一手打完也要 ${best.restHands} 手才走得完,不如先过一手把大牌留着。`;
}

/** 三档提示的统一入口 */
export function searchHint(input: HintInput, mode: HintMode = "coach"): HintResult {
  if (mode === "off") {
    return {
      mode,
      play: null,
      pass: false,
      reason: HINT_MODE_DESC.off,
      searched: 0,
      ranked: [],
    };
  }

  const ranked = rankCandidates(input);
  const searched = ranked.length;

  if (mode === "groups") {
    return {
      mode,
      play: null,
      pass: searched === 0 && input.prev !== null,
      reason: groupsSummary(ranked.map((c) => c.play)),
      searched,
      ranked,
    };
  }

  if (searched === 0) {
    return {
      mode,
      play: null,
      pass: input.prev !== null,
      reason: input.prev
        ? "这一手一种压法都搜不到,点「不要」过一手,等自己重新先手。"
        : "手里已经没牌啦!",
      searched: 0,
      ranked,
    };
  }

  const best = ranked[0];
  // 跟牌时才有「过一手」这个选项:和困难档 AI 用同一个门槛,压得住就尽量压
  if (input.prev && !best.finisher) {
    const foeLeft = input.counts.filter((_, i) => i !== input.seat && !sameTeam(i, input.seat, input.landlord));
    const foeMin = foeLeft.length > 0 ? Math.min(...foeLeft) : 99;
    const onlyBombs = ranked.every((c) => c.usesBomb);
    const passScore = positionScore(input.hand) - PASS_MARGIN;
    if ((onlyBombs && foeMin > BOMB_PATIENCE_CARDS) || best.score >= passScore) {
      return { mode, play: null, pass: true, reason: explainPass(best, searched), searched, ranked };
    }
  }

  return {
    mode,
    play: best.play,
    pass: false,
    reason: explainChoice(input.hand, best, searched, input.prev),
    searched,
    ranked,
  };
}
