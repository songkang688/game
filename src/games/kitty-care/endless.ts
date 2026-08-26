/**
 * 萌猫小屋 · 无尽「照顾马拉松」的难度曲线（1.2 新增，纯函数）。
 *
 * 规则一句话：任务一个接一个来，做完一个进下一个，节奏越来越紧。
 * **没有失败结局**——时间到只是这一轮不计分，下一轮照样开始，
 * 猫不会生气、不会走掉，屏幕上也不会出现催命的红色倒计时。
 */
import type { KittyTask } from "./levels";

/** 七种任务轮着上场（顺序固定，孩子能预判下一件事是什么） */
export const ENDLESS_ORDER: readonly KittyTask[] = ["feed", "play", "wash", "sleep", "dress", "cure", "style"];

/** 第一轮给多少秒 */
export const ENDLESS_START_SEC = 34;
/** 时间压到这里就不再压（留足够的余量，永远做得完） */
export const ENDLESS_MIN_SEC = 14;
/** 同屏最多几只猫 */
export const ENDLESS_MAX_CATS = 3;

export interface EndlessRound {
  /** 第几轮（1 基） */
  index: number;
  task: KittyTask;
  /** 这一轮的时限（秒），只减不增 */
  timeSec: number;
  /** 同屏几只猫，只增不减 */
  cats: number;
  /** 任务复杂度档位（1..5），只升不降：决定要扑几次、几个泡泡、几步护理 */
  complexity: number;
  /** 选项数，只增不减 */
  options: number;
}

/** 第 n 轮（1 基）长什么样；四条线都是单调的 */
export function endlessRound(n: number): EndlessRound {
  const i = Math.max(1, Math.floor(n));
  const step = i - 1;
  return {
    index: i,
    task: ENDLESS_ORDER[step % ENDLESS_ORDER.length],
    timeSec: Math.max(ENDLESS_MIN_SEC, ENDLESS_START_SEC - Math.floor(step / 2)),
    cats: Math.min(ENDLESS_MAX_CATS, 1 + Math.floor(step / 9)),
    complexity: Math.min(5, 1 + Math.floor(step / 5)),
    options: Math.min(6, 3 + Math.floor(step / 7))
  };
}

/** 这一轮的任务参数（把复杂度翻译成具体数字） */
export interface EndlessParams {
  playTaps: number;
  washCells: number;
  notes: number;
  cureSteps: number;
  styleSlots: number;
}

export function endlessParams(round: EndlessRound): EndlessParams {
  const c = Math.max(1, Math.min(5, round.complexity));
  return {
    playTaps: 1 + c,
    washCells: 5 + c,
    notes: 2 + c,
    cureSteps: Math.min(4, 1 + c),
    styleSlots: Math.min(4, 2 + Math.floor(c / 2))
  };
}

/**
 * 超时的处理：**不是失败**。这一轮不计分，直接进下一轮。
 * 返回下一轮的轮号与一句安慰话（永远不出现「输了」「失败」这类词）。
 */
export function endlessTimeout(round: EndlessRound): { nextIndex: number; scored: false; note: string } {
  return {
    nextIndex: round.index + 1,
    scored: false,
    note: "这一件慢了一点点，没关系——小猫已经跑去下一件事啦！"
  };
}

/** 做完一件的加分：一轮就是一分（成绩＝一共照顾好了几件事） */
export function endlessScore(done: number): number {
  return Math.max(0, Math.floor(done));
}

/** 结算文案：只报做到了第几件，不批评 */
export function endlessLine(done: number, best: number): string {
  if (done <= 0) return "先热个身～照顾马拉松没有输赢，做完一件就进下一件。";
  if (done >= best) return `这一轮照顾好了 ${done} 件事，是你目前的最好成绩！`;
  return `这一轮照顾好了 ${done} 件事，最好成绩是 ${best} 件，再来一次就能追上。`;
}
