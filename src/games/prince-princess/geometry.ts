/**
 * 王子公主大冒险 · 几何红线(纯常量,谁都可以依赖,它谁也不依赖)。
 *
 * 这几个数比 `logic.ts` 那套跳跃物理算出来的极限更保守,留足容错;
 * `logic.test.ts` 会断言它们确实小于王子(跳得最矮的那位)的物理极限。
 *
 * 1.2 把它们从 `levels.ts` 挪出来单独放,是因为无尽城堡塔 `tower.ts` 也要照着同一套红线校验,
 * 两边都从这儿取数,就不会出现「关卡按 118 卡、塔按 120 卡」这种飘移。
 * `levels.ts` 原样 re-export,老的 `import { MAX_GAP } from "./levels"` 一个字都不用改。
 */

/** 地面断口最窄(太窄反而看不清) */
export const MIN_GAP = 56;
/** 地面断口最宽:必须明显小于王子一次跳跃的水平距离 */
export const MAX_GAP = 118;
/** 空中平台最高:必须明显小于王子一次跳跃的最高点 */
export const MAX_PLATFORM_RISE = 86;
/** 关卡最左边这一段永远是干净平地,给玩家看清楚状况 */
export const START_PAD = 230;
/** 城门离关卡末端的距离 */
export const GOAL_INSET = 130;
/** 首领擂台的宽度 */
export const ARENA_LEN = 1500;

/** 断口两头各留这么宽的干净实地当起跳台和落脚点 */
export const LANDING_PAD = 60;
/** 一段尖刺最宽:必须一跳跨得过去 */
export const MAX_SPIKE_RUN = 76;
/** 尖刺两头各留这么宽的干净地 */
export const SPIKE_CLEAR = 70;
