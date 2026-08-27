// 花园守卫 1.2 —— 波次预览、提前召唤奖励、定步长速度控制。
// 纯逻辑,不依赖 DOM;运行时和单测用同一份。

import { MONSTER_INFO, MonsterKind, WaveEntry, monsterHp, waveMonsterCount } from "./logic";
import { ARCHETYPE_LABEL, EnemyArchetype, enemyArchetypes } from "./towers12";

/* ---------------- 波次预览 ---------------- */

/** 预览条上的小图标:让不认字的孩子也能看出下一波来的是什么。 */
export const MONSTER_EMOJI: Record<MonsterKind, string> = {
  softy: "🟣",
  fasty: "💨",
  tanky: "🟠",
  dashy: "⚡",
  shieldy: "🛡️",
  splity: "🟢",
  sneaky: "🌫️",
  healy: "💗",
  mini: "🔹",
  flappy: "🕊️",
  glidey: "☁️",
  boss1: "👑",
  boss2: "🦀",
  boss3: "🍄",
  boss4: "🏜️",
  boss5: "🐸",
  boss6: "⛄",
  boss7: "🌋",
  boss8: "🌙",
  boss9: "🍬",
  boss10: "💠",
  boss11: "⚙️",
  boss12: "🪽",
  boss13: "🌠",
  bossArmor: "🛡️",
  bossSwift: "🌪️",
  bossFly: "🪁",
  bossSplit: "🍒",
};

export interface WavePreviewItem {
  kind: MonsterKind;
  count: number;
  emoji: string;
  name: string;
  boss: boolean;
  archetypes: EnemyArchetype[];
}

/** 下一波的组成:同一种怪分几批来也只显示一格,数量相加。顺序按首次出现。 */
export function wavePreview(wave: ReadonlyArray<WaveEntry>): WavePreviewItem[] {
  const order: MonsterKind[] = [];
  const counts = new Map<MonsterKind, number>();
  for (const e of wave) {
    if (!counts.has(e.kind)) order.push(e.kind);
    counts.set(e.kind, (counts.get(e.kind) ?? 0) + e.count);
  }
  return order.map((kind) => ({
    kind,
    count: counts.get(kind) ?? 0,
    emoji: MONSTER_EMOJI[kind],
    name: MONSTER_INFO[kind].name,
    boss: MONSTER_INFO[kind].boss,
    archetypes: enemyArchetypes(kind),
  }));
}

/** 预览条读出来的一句话(朗读与 360px 兜底文字共用)。 */
export function wavePreviewLine(wave: ReadonlyArray<WaveEntry>): string {
  const items = wavePreview(wave);
  if (items.length === 0) return "这一波空空的";
  return items.map((i) => `${i.name}×${i.count}`).join("、");
}

/** 这一波值得提醒的原型(去重,BOSS 优先),给「准备一下」的小提示用。 */
export function waveArchetypeHints(wave: ReadonlyArray<WaveEntry>): EnemyArchetype[] {
  const seen = new Set<EnemyArchetype>();
  for (const item of wavePreview(wave)) {
    for (const a of item.archetypes) if (a !== "plain") seen.add(a);
  }
  return [...seen];
}

/** 提示语:「这波有会飞的、有硬壳的」。 */
export function waveHintLine(wave: ReadonlyArray<WaveEntry>): string {
  const hints = waveArchetypeHints(wave);
  if (hints.length === 0) return "都是普通小怪,放心打";
  return `这波有${hints.map((a) => ARCHETYPE_LABEL[a]).join("、")}`;
}

export function waveHasBoss(wave: ReadonlyArray<WaveEntry>): boolean {
  return wave.some((e) => MONSTER_INFO[e.kind].boss);
}

/** 一波的「压力值」:总血量 + 数量权重,用来断言无尽波次确实越来越难。 */
export function waveThreat(wave: ReadonlyArray<WaveEntry>, levelIdx: number): number {
  let threat = 0;
  for (const e of wave) {
    threat += e.count * (monsterHp(e.kind, levelIdx) + MONSTER_INFO[e.kind].armor);
  }
  return threat + waveMonsterCount(wave);
}

/* ---------------- 提前召唤 ---------------- */

/** 布阵时间:看完预览、补两座塔够用。 */
export const PREWAVE_SECONDS = 6;
/** 提前召唤最多奖励几片花瓣。 */
export const EARLY_CALL_MAX_BONUS = 6;

/**
 * 提前召唤下一波换奖励:剩下的布阵时间越多,奖励越高。
 * 全部时间都不要 = 满奖励;时间快用完了才点 = 至少还有 1 片(不做无意义的 0)。
 */
export function earlyCallBonus(remaining: number, total = PREWAVE_SECONDS): number {
  if (total <= 0) return 0;
  const left = Math.max(0, Math.min(total, remaining));
  return Math.max(1, Math.round((left / total) * EARLY_CALL_MAX_BONUS));
}

/* ---------------- 速度控制(定步长) ---------------- */

/** 逻辑固定步长:1× 与 2× 都按这个步长积分,只是每帧走的步数不同。 */
export const SPEED_STEP = 1 / 60;
/** 一帧最多补几步,防止切后台回来一次性追上百步卡死。 */
export const MAX_STEPS_PER_FRAME = 16;

/** 0 = 暂停布阵,1 = 正常,2 = 快进。 */
export type SpeedMode = 0 | 1 | 2;
export const SPEED_MODES: SpeedMode[] = [1, 2];

export interface StepPlan {
  steps: number;
  carry: number;
  /** true = 这一帧被 MAX_STEPS_PER_FRAME 截断了(切后台回来) */
  clamped: boolean;
}

/**
 * 把一帧的真实耗时换算成「走几个固定步长」。
 * 暂停(speed=0)时一步都不走,余数也不累积——回来接着摆塔,不会突然快进。
 */
export function accumulateSteps(
  carry: number,
  frameDt: number,
  speed: SpeedMode,
  step: number = SPEED_STEP,
  maxSteps: number = MAX_STEPS_PER_FRAME,
): StepPlan {
  if (speed <= 0) return { steps: 0, carry, clamped: false };
  let acc = carry + Math.max(0, frameDt) * speed;
  let steps = Math.floor(acc / step);
  let clamped = false;
  if (steps > maxSteps) {
    steps = maxSteps;
    acc = step * maxSteps;
    clamped = true;
  }
  return { steps, carry: acc - steps * step, clamped };
}

/**
 * 一串帧下来一共走了几步。
 * 1× 跑 2 秒真实时间与 2× 跑 1 秒真实时间,步数必须一样——这是「2× 与 1× 结果一致」的根。
 */
export function totalSteps(frames: ReadonlyArray<number>, speed: SpeedMode, step: number = SPEED_STEP): number {
  let carry = 0;
  let total = 0;
  for (const dt of frames) {
    const plan = accumulateSteps(carry, dt, speed, step, Number.MAX_SAFE_INTEGER);
    carry = plan.carry;
    total += plan.steps;
  }
  return total;
}
