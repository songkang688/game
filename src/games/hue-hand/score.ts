/**
 * 花色接龙 · 计分。
 *
 * 一局打完,赢家把其余每个人手里剩的牌加起来收进自己的分数:
 * 数字牌按面值,跳过 / 反转 / 加二各 20 分,万能换色 / 万能加四各 50 分。
 * 分数只是星星分,和真钱、道具都没有半点关系。
 */
import { cardScore, type Card } from "./deck";

/** 一手牌值多少分 */
export function handScore(hand: readonly Card[]): number {
  let sum = 0;
  for (const card of hand) sum += cardScore(card);
  return sum;
}

/** 赢家这一局收多少分:其余所有人手牌之和 */
export function roundScore(hands: readonly (readonly Card[])[], winner: number): number {
  let sum = 0;
  for (let i = 0; i < hands.length; i++) {
    if (i !== winner) sum += handScore(hands[i]);
  }
  return sum;
}

/** 把这一局的得分累加进总分表(纯函数,回新表) */
export function addRound(totals: readonly number[], winner: number, gained: number): number[] {
  const out = totals.slice();
  if (winner >= 0 && winner < out.length) out[winner] += gained;
  return out;
}

/** 先到目标分的人赢下整场;都没到就回 -1 */
export function matchWinner(totals: readonly number[], target: number): number {
  let best = -1;
  for (let i = 0; i < totals.length; i++) {
    if (totals[i] >= target && (best < 0 || totals[i] > totals[best])) best = i;
  }
  return best;
}

/** 结算面板上那句「这一局收了 34 分」 */
export function scoreLine(gained: number, total: number, target: number): string {
  const left = Math.max(0, target - total);
  if (left === 0) return `这一局收了 ${gained} 分,总分 ${total},够 ${target} 分,整场拿下!`;
  return `这一局收了 ${gained} 分,总分 ${total},离 ${target} 分还差 ${left} 分。`;
}

/** 剩几张牌的一句提示,只鼓励不批评 */
export function leftoverLine(left: number): string {
  if (left <= 1) return "差一张就出完啦,下一局先攒个万能牌。";
  if (left <= 3) return `手上还剩 ${left} 张,已经很接近了,下一局早点把颜色理顺。`;
  return `手上还剩 ${left} 张,下一局先把同色的连成一串,出得更快。`;
}
