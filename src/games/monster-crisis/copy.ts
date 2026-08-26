// 小怪物危机 1.2 —— 竞技场版的结算文案(纯函数)。
//
// 1.1 的 `winLine` / `loseLine` 满嘴「棉花墙、炮台、第几条道」,那是塔防时代的说法;
// 1.2 是「自己上场跑位出手」,文案得跟着改口,不然孩子照着做只会更懵。
// 老函数原样留在 `logic.ts` 里给老用例守着,这里是新的一套。
//
// 三条底线:不说血、不说输赢里的丧气话、失败只讲下一步怎么做。

import { LANES } from "./logic";

/** 家周围分成五个方向,和 `arena.laneOfPoint` 的扇区一一对应(角度从右边开始顺时针)。 */
export const SECTOR_NAMES = ["右下角", "正下方", "左边", "左上角", "右上角"];

export function sectorName(sector: number): string {
  if (!Number.isFinite(sector) || sector < 0 || sector >= LANES) return "家门口";
  return SECTOR_NAMES[Math.floor(sector)];
}

/** 过关:先说好在哪儿,再给一句下次能更好的具体做法。 */
export function arenaWinLine(jars: number, maxJars: number, popped: number): string {
  if (jars >= maxJars) {
    return `一罐元气都没丢!${popped} 只小怪物全变成小云朵飘走啦,跑位稳得很。`;
  }
  if (jars >= maxJars - 1) {
    return `守住啦!只被抱走一罐元气,下次早一点迎上去,在半路就把它们涂花。`;
  }
  return `守住啦!这次有点惊险,记得别站在家门口硬扛,绕着家跑起来更好打。`;
}

/** 没守住:只鼓励 + 一句具体的下一步,一个丧气字都不许有。 */
export function arenaLoseLine(wavesCleared: number, waveTotal: number, weakSector: number): string {
  const where = weakSector >= 0 ? sectorName(weakSector) : "家门口";
  if (wavesCleared <= 0) {
    return `第一波就有点急啦!先站在家和小怪物中间,按住技能钮别松手,它们靠近就退两步。再来一次!`;
  }
  if (waveTotal > 0 && wavesCleared >= waveTotal - 1) {
    return `就差最后一波啦!${where}漏得最多,下一次多守那一边,这一关就是你的了。`;
  }
  return `已经挡下 ${wavesCleared} 波啦!${where}漏得最多,下一次早点绕过去,一定更远。`;
}

/** 无尽:成绩说清楚,再给一句往前推的话。 */
export function arenaEndlessLine(reached: number, best: number): string {
  if (reached > 0 && reached >= best) return `第 ${reached} 波!这是你的新纪录,厉害!`;
  if (reached <= 0) return "刚热身呢,先捡元气糖把家里补满,下一局一定更远!";
  return `挡住了 ${reached} 波,离最好成绩第 ${best} 波还差一点点,再来!`;
}

/** 双人合作:两个人共享波次,各自成长。 */
export function arenaCoopLine(cleared: number, target: number, popped: number): string {
  if (cleared >= target) {
    return `两个人一起把 ${target} 波全挡下来啦,${popped} 只小怪物变成小云朵飘走了!`;
  }
  return `一起挡到第 ${cleared} 波!下一次一人守一边、中间那块轮着补,肯定更远。`;
}

/** 一人一半的对战:先失守的那边输,元气一样多就是平局。 */
export function arenaVersusLine(winner: number, jars: readonly number[], names: readonly string[]): string {
  const a = jars[0] ?? 0;
  const b = jars[1] ?? 0;
  if (winner < 0) return `两边都守住啦,各剩 ${a} 罐元气,这局是平手!再来一局分个高下?`;
  const win = names[winner] ?? "赢家";
  const lose = names[1 - winner] ?? "对手";
  return `${win}这边守得更稳,还剩 ${winner === 0 ? a : b} 罐元气!${lose}下一局早点迎上去就追得回来。`;
}

/** 成长面板顶上的一句话:告诉孩子这是在挑什么。 */
export function draftTitle(round: number): string {
  if (round <= 1) return "🎁 开工礼物:挑一样带上场";
  return `🎁 第 ${round} 次成长:挑一样变强`;
}
