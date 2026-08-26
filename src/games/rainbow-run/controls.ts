// 彩虹跑跑 · 操作三件套(1.1 第 6 步新增)
//
// 跳跃:上滑 / W / ↑ / 空格
// 换道:左右滑 / A D / ← →
// 滚翻:下滑 / S / ↓
//
// 外加两个手感参数——土狼时间与输入缓冲。它们是「明明按了却没跳起来」的解药:
//   · 土狼时间:刚踏空的一小会儿还算站在地上,晚按一点也跳得起来
//   · 输入缓冲:落地前一小会儿按下的跳,落地那一刻自动补上
// 两个参数都是常量,配套的判定写成纯函数,好单独测边界。

import type { SwipeDir } from "./logic";

/** 跑酷里真正要执行的四种操作。 */
export type RunInput = "left" | "right" | "jump" | "roll";

/**
 * 键位表。单字符按键统一按小写查,所以大小写都认;
 * 空格在新浏览器里是 " ",老浏览器给的是 "Spacebar",两种都收。
 */
const KEY_MAP: Readonly<Record<string, RunInput>> = {
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
  arrowup: "jump",
  w: "jump",
  " ": "jump",
  spacebar: "jump",
  arrowdown: "roll",
  s: "roll",
};

/** 键盘事件的 key → 操作;不管的键返回 null,好让 index.ts 决定要不要 preventDefault。 */
export function inputForKey(key: string): RunInput | null {
  if (!key) return null;
  return KEY_MAP[key.toLowerCase()] ?? null;
}

/** 滑动方向 → 操作。 */
export function inputForSwipe(dir: SwipeDir): RunInput {
  if (dir === "left") return "left";
  if (dir === "right") return "right";
  if (dir === "up") return "jump";
  return "roll";
}

/** 这个操作是不是换道。 */
export function isLaneInput(input: RunInput): boolean {
  return input === "left" || input === "right";
}

/** 换道操作对应的车道增量。 */
export function laneStep(input: RunInput): number {
  if (input === "left") return -1;
  if (input === "right") return 1;
  return 0;
}

/* ---------------- 土狼时间 与 输入缓冲 ---------------- */

/** 离开地面之后,还有这么久仍然算「站在地上」,跳得起来。 */
export const COYOTE_TIME = 0.09;
/** 落地之前这么久按下的跳,会被记住,落地那一刻自动补上。 */
export const INPUT_BUFFER = 0.12;

export interface JumpFeel {
  /** 离地多久(秒);贴着地面时是 0 */
  airTime: number;
  /** 距离上一次按跳过了多久(秒);从来没按过、或者已经用掉了是 Infinity */
  sincePress: number;
}

export function initJumpFeel(): JumpFeel {
  return { airTime: 0, sincePress: Infinity };
}

/** 每帧推进一次:贴地就把离地计时清零,按键计时一直往前走。 */
export function feelTick(feel: JumpFeel, dt: number, onGround: boolean): JumpFeel {
  const step = dt > 0 ? dt : 0;
  return {
    airTime: onGround ? 0 : feel.airTime + step,
    sincePress: Number.isFinite(feel.sincePress) ? feel.sincePress + step : Infinity,
  };
}

/** 玩家按下了跳:记下这一刻。 */
export function feelPress(feel: JumpFeel): JumpFeel {
  return { airTime: feel.airTime, sincePress: 0 };
}

/** 缓冲还新鲜吗(刚按下没多久)。 */
export function hasBufferedJump(feel: JumpFeel): boolean {
  return feel.sincePress <= INPUT_BUFFER;
}

/** 现在还能起跳吗(踩着地,或者刚踏空还在土狼时间里)。 */
export function hasCoyote(feel: JumpFeel, onGround: boolean): boolean {
  return onGround || feel.airTime <= COYOTE_TIME;
}

/** 这一帧到底该不该起跳:有新鲜的按键,而且脚下还够得着。 */
export function feelWantsJump(feel: JumpFeel, onGround: boolean): boolean {
  return hasBufferedJump(feel) && hasCoyote(feel, onGround);
}

/** 跳出去了,把缓冲用掉,免得一次按键跳两下。 */
export function feelConsume(feel: JumpFeel): JumpFeel {
  return { airTime: feel.airTime, sincePress: Infinity };
}
