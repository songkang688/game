// 寻找外星朋友:不碰 DOM 的「一定玩得完吗」检查。
//
// 限时是关卡数据里写死的,写得太紧就会出现「怎么点都来不及」的关。
// 这里按最慢的一种玩法算账——键盘一格一格挪光标(鼠标和触屏是直接点,只会更快):
// 光标从出生点出发,每次去最近的那个还没找到的目标,把总耗时加起来。
// 单测拿它对全部 188 关、无尽轮、对战场逐个断言,保证限时永远够用。
import { CURSOR_SPEED, travelTime } from "./logic";
import type { SeekLevel } from "./levels";

/** 光标出生在场景正中偏左的位置(和 index.ts 里保持一致) */
export const START_X = 350;
export const START_Y = 320;
/** 看清一个目标、按下确认键要花的反应时间 */
export const REACT_SEC = 0.45;
/** 推理关:读懂一条线索大概要几秒(按六年级的阅读速度估) */
export const READ_CLUE_SEC = 4;

export interface SolveReport {
  /** 按最慢玩法走完全程要几秒 */
  seconds: number;
  /** 关卡给的限时 */
  limit: number;
  /** 走完之后还剩几秒 */
  spare: number;
  /** 光标一共走了多远 */
  distance: number;
}

/**
 * 贪心走一遍:每次去最近的那个还没找到的目标。
 * 这不是最优路线(最优是旅行商问题),所以算出来的耗时只会比真人玩的偏长——
 * 用它当上界来卡限时是安全的。
 */
export function solveLevel(lv: SeekLevel): SolveReport {
  const goals =
    lv.mode === "deduce" ? [lv.spots[lv.answer]] : lv.targets.map((t) => lv.spots[t.spot]);

  let x = START_X;
  let y = START_Y;
  let seconds = lv.mode === "deduce" ? READ_CLUE_SEC * lv.clues.length : 0;
  let distance = 0;
  const todo = goals.slice();

  while (todo.length > 0) {
    let bestK = 0;
    let bestT = Infinity;
    for (let k = 0; k < todo.length; k++) {
      const t = travelTime(x, y, todo[k].x, todo[k].y);
      if (t < bestT) {
        bestT = t;
        bestK = k;
      }
    }
    const next = todo.splice(bestK, 1)[0];
    distance += bestT * CURSOR_SPEED;
    seconds += bestT + REACT_SEC;
    x = next.x;
    y = next.y;
  }

  return {
    seconds: Math.round(seconds * 100) / 100,
    limit: lv.seconds,
    spare: Math.round((lv.seconds - seconds) * 100) / 100,
    distance: Math.round(distance),
  };
}

/** 这一关的限时够不够(至少要留 margin 秒的富余,给小朋友找东西的时间) */
export function levelIsBeatable(lv: SeekLevel, margin = 6): boolean {
  return solveLevel(lv).spare >= margin;
}
