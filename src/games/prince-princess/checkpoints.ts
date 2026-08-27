/**
 * 王子公主大冒险 · 检查点与小云朵(纯函数,不碰 DOM)。
 *
 * 1.1 掉进断口的处理是「就地往回找块实地放回去、扣一颗心」,心掉光整关从头再来。
 * 一关最长三千多像素,倒在最后一段就得从起跑区重跑,连捡到的宝石都清零——挫败感很实。
 *
 * 1.2 改成:
 *
 *  1. 每关按主路均分 **至少 2 面小旗**(`checkpointsFor`),旗子只落在站得稳的实地上;
 *  2. **两个人都走过**一面旗,那面旗才点亮 —— 这是双人游戏,
 *     一个人冲在前头就把旗点了的话,另一个人会被托到自己根本没去过的地方;
 *  3. 摔下去 / 被撞开的人**变成一朵小云**,飘回最近那面点亮的旗;
 *  4. 飘回**只挪人**:宝石、清怪数、已经开的城门统统保留,不许整关重来。
 *
 * 文案里没有任何「死」「输」的说法,只是「被小云朵托回休息点」。
 */
import { GOAL_INSET, START_PAD, groundSolidAt, type LevelDef } from "./levels";

/** 每关最少几面旗 */
export const MIN_CHECKPOINTS = 2;
/** 每关最多几面旗 */
export const MAX_CHECKPOINTS = 6;
/**
 * 旗与旗之间大概隔这么远。
 *
 * 这个数直接决定「摔一次要重跑多远」:太稀就等于没有检查点(1.1 的老毛病),
 * 太密又会让人觉得关卡被切碎。420px 差不多是跑两秒的距离。
 */
export const FLAG_SPACING = 420;
/** 旗子前后各留这么宽的实地,免得被托回来就站在断口边上 */
const ROOM = 56;

/**
 * 这个 x 站得稳吗:脚下实心、前后各留半个身位,而且**没踩在尖刺上**。
 *
 * 尖刺这一条是血的教训:旗子插在尖刺堆里,被托回来的人一落地就再挨一下,
 * 挨完再被托回来,原地循环 —— 熔岩火山和冰霜雪原两章会当场爆掉。
 */
function roomy(def: Pick<LevelDef, "gaps" | "len" | "spikes">, x: number): boolean {
  if (!groundSolidAt(def, x)) return false;
  if (!groundSolidAt(def, Math.max(12, x - ROOM))) return false;
  if (!groundSolidAt(def, Math.min(def.len - 12, x + ROOM))) return false;
  return !def.spikes.some((s) => x > s.x - ROOM && x < s.x + s.w + ROOM);
}

/**
 * 给一关挑旗子的位置(世界坐标 x,从左到右)。
 *
 * 做法:起跑区末端到城门之间均分成 n+1 段,每个分界处往两边找最近的一块稳地。
 * 纯函数 —— 同一关每次挑出来的位置完全一样,和渲染、和随机数都没关系。
 */
export function checkpointsFor(def: LevelDef): number[] {
  const from = START_PAD;
  const to = Math.max(from + 1, def.goalX - GOAL_INSET * 0.4);
  const span = to - from;
  const want = Math.max(MIN_CHECKPOINTS, Math.min(MAX_CHECKPOINTS, Math.round(span / FLAG_SPACING)));
  const out: number[] = [];
  for (let i = 1; i <= want; i++) {
    const ideal = from + (span * i) / (want + 1);
    let hit = -1;
    for (let off = 0; off <= span; off += 8) {
      for (const probe of [ideal - off, ideal + off]) {
        const x = Math.round(probe);
        if (x <= from || x >= to) continue;
        if (out.some((k) => Math.abs(k - x) < FLAG_SPACING * 0.5)) continue;
        if (!roomy(def, x)) continue;
        hit = x;
        break;
      }
      if (hit >= 0) break;
    }
    if (hit >= 0) out.push(hit);
  }
  // 兜底:再挤也得凑够两面,不然「回检查点」就成了空话
  let guard = 0;
  while (out.length < MIN_CHECKPOINTS && guard++ < 200) {
    const x = Math.round(from + (span * (out.length + 1)) / (MIN_CHECKPOINTS + 1)) + guard * 7;
    if (x > from && x < to && !out.includes(x) && groundSolidAt(def, x)) out.push(x);
  }
  out.sort((a, b) => a - b);
  return out;
}

/**
 * 两人都越过了第几面旗(0 基;-1 表示一面都还没点亮)。
 * 只往前记不往回退,所以要把上一次的 `current` 传进来。
 */
export function updateReached(flags: readonly number[], current: number, heroXs: readonly number[]): number {
  let next = current;
  for (let i = 0; i < flags.length; i++) {
    if (heroXs.length > 0 && heroXs.every((x) => x >= flags[i])) next = Math.max(next, i);
  }
  return next;
}

/**
 * 小云朵该把人放到哪儿。
 *
 * 取两个里靠前的那一个:
 *  - 两人都点亮的那面旗(`reached`)—— 这是**保底**,搭档再落后也不会被送到没去过的地方;
 *  - 摔下去的人自己刚走过的那面旗 —— 他一个人冲在前面,就让他从自己那面旗接着来,
 *    不然一摔就退回搭档所在的位置,重跑得太狠。
 *
 * 一面都没走过就回起跑区。
 */
export function respawnX(
  def: LevelDef,
  flags: readonly number[],
  reached: number,
  heroX = -Infinity
): number {
  let best = reached >= 0 && reached < flags.length ? flags[reached] : null;
  for (const f of flags) {
    if (f <= heroX && (best === null || f > best)) best = f;
  }
  return best ?? Math.min(74, def.len - 24);
}

/** 摔下去之后保留哪些东西 —— 只挪人,别的一样不动 */
export interface CarryOver {
  gems: number;
  kills: number;
  doorOpened: boolean;
}

export function carryOver(w: { gemsTaken: number; kills: number }, doorOpened: boolean): CarryOver {
  return { gems: w.gemsTaken, kills: w.kills, doorOpened };
}

/** 被托回去时说的那一句(没有任何「摔坏了」的描写) */
export function cloudLine(who: string, reached: number): string {
  return reached < 0
    ? `${who}被小云朵托回出发点啦,捡到的宝石都还在。`
    : `${who}被小云朵托回上一面小旗啦,捡到的宝石都还在。`;
}

/** HUD 上那颗小旗的文字 */
export function checkpointLabel(flags: readonly number[], reached: number): string {
  if (flags.length === 0) return "🚩 —";
  return `🚩 ${reached + 1}/${flags.length}`;
}
