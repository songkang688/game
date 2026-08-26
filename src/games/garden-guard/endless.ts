// 花园守卫 1.2 —— 无尽「守到底」(第 13 步 A 档补做)。
//
// 规则:一片固定的花园,波次无限往上加。每 5 波来一位「原型 BOSS」,
// 护甲 → 迅捷 → 飞行 → 分裂 轮着上,正好把四类机制各考一遍。
// 五颗心掉完就结束,撑到第几波就是成绩,交给 save.recordEndlessBest("garden-guard", wave)。
//
// 全部是确定性的:同一个波号永远长一模一样的阵容,
// 所以「第 17 波特别难」这种事可以在单测里复现,也方便孩子第二次挑战时心里有数。

import {
  MONSTER_INFO,
  MonsterKind,
  THEME_ORDER,
  ThemeId,
  WaveEntry,
  monsterHp,
  monsterReward,
} from "./logic";

/** 无尽也是五颗心,和闯关一致,不另立规矩。 */
export const ENDLESS_HEARTS = 5;
/** 开局花瓣:比闯关中段稍宽裕,因为一上来就是全塔可用。 */
export const ENDLESS_START_PETALS = 16;
/** 每几波来一位 BOSS。 */
export const ENDLESS_BOSS_EVERY = 5;
/** 一批怪最多几只,免得屏幕糊成一片。 */
export const ENDLESS_MAX_BATCH = 14;

/** 无尽花园的路线:一条绕满全场的长路,拐角多、塔位足。 */
export const ENDLESS_PATH: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [7, 0],
  [7, 2],
  [1, 2],
  [1, 4],
  [8, 4],
];

/** 四位原型 BOSS,按护甲 / 迅捷 / 飞行 / 分裂的顺序轮着来。 */
export const ENDLESS_BOSS_ROTATION: MonsterKind[] = ["bossArmor", "bossSwift", "bossFly", "bossSplit"];

/** 每往上一波,单只怪的难度参照关号加多少。 */
export const ENDLESS_LEVEL_STEP = 22;

/** 第 n 波的难度参照关号:一直往上走,不封顶,所以无尽真的无尽。 */
export function endlessLevelIndex(wave: number): number {
  const n = Math.max(1, Math.round(wave));
  return 20 + (n - 1) * ENDLESS_LEVEL_STEP;
}

/**
 * 花瓣产出参照的关号——故意比血量参照涨得慢得多。
 * 闯关里 `monsterReward` 跟着关号一路涨,直接套到无尽上,
 * 到第 40 波一只小怪就掉五十多片花瓣,塔位早就摆满了钱还花不完,
 * 「无尽」就成了「无聊」。经济单独走一条平缓的线,压力才追得上。
 */
export const ENDLESS_REWARD_STEP = 4;

export function endlessRewardIndex(wave: number): number {
  const n = Math.max(1, Math.round(wave));
  return 15 + (n - 1) * ENDLESS_REWARD_STEP;
}

/** 第 n 波打倒一只 kind 给几片花瓣。 */
export function endlessKillReward(kind: MonsterKind, wave: number): number {
  return monsterReward(kind, endlessRewardIndex(wave));
}

/** 第 n 波是不是 BOSS 波。 */
export function isEndlessBossWave(wave: number): boolean {
  const n = Math.max(1, Math.round(wave));
  return n % ENDLESS_BOSS_EVERY === 0;
}

/** 第 n 波的 BOSS 是谁(不是 BOSS 波就返回 null)。 */
export function endlessBossKind(wave: number): MonsterKind | null {
  if (!isEndlessBossWave(wave)) return null;
  const round = Math.round(wave) / ENDLESS_BOSS_EVERY;
  return ENDLESS_BOSS_ROTATION[(round - 1) % ENDLESS_BOSS_ROTATION.length];
}

/** 第 n 波配色(纯装饰,每 5 波换一片风景,塔位不受影响)。 */
export function endlessTheme(wave: number): ThemeId {
  const n = Math.max(1, Math.round(wave));
  return THEME_ORDER[Math.floor((n - 1) / ENDLESS_BOSS_EVERY) % THEME_ORDER.length];
}

/** 第 n 波能出场的怪种:一波比一波多一样花活。 */
export function endlessPool(wave: number): MonsterKind[] {
  const n = Math.max(1, Math.round(wave));
  const pool: MonsterKind[] = ["softy"];
  if (n >= 2) pool.push("fasty");
  if (n >= 3) pool.push("tanky");
  if (n >= 4) pool.push("dashy");
  if (n >= 6) pool.push("shieldy");
  if (n >= 7) pool.push("splity");
  if (n >= 8) pool.push("flappy");
  if (n >= 9) pool.push("sneaky");
  if (n >= 11) pool.push("healy");
  if (n >= 13) pool.push("glidey");
  return pool;
}

/** 一只怪要打掉多少「工作量」(血 + 壳)。 */
function unitLoad(kind: MonsterKind, levelIdx: number): number {
  return monsterHp(kind, levelIdx) + MONSTER_INFO[kind].armor;
}

/**
 * 第 n 波的小怪「工作量预算」(血 + 壳的总和)。
 *
 * 二次曲线是故意的。单只怪的血量跟着 `endlessLevelIndex` 只是线性上涨,
 * 而玩家这边格子有限、塔终究会摆满,输出迟早封顶——
 * 只让血量线性涨的话,封顶之后的每一波都一样轻松,那就不是无尽是散步。
 * 预算按 n² 走,数量与单只血量各出一半力,压力才会稳稳越过任何一条封顶线。
 */
export function endlessBudget(wave: number): number {
  const n = Math.max(1, Math.round(wave));
  return 12 + n * 10 + n * n;
}

/**
 * 第 n 波分几批来。批数不封顶,和预算一起往上走。
 * 封顶的话后期每批都会撞上 `ENDLESS_MAX_BATCH`,
 * 一波的总量就变成「批数 × 上限 × 这次抽到的怪多重」——
 * 抽到飘飘怪的那波比抽到云朵怪的那波轻一大半,压力曲线立刻锯齿化。
 */
export function endlessBatchCount(wave: number): number {
  const n = Math.max(1, Math.round(wave));
  if (n < 3) return 1;
  return Math.max(2, 1 + Math.floor(n / 6));
}

/** 第 n 波的完整阵容。同一个 n 永远返回一模一样的数据。 */
export function endlessWave(wave: number): WaveEntry[] {
  const n = Math.max(1, Math.round(wave));
  const idx = endlessLevelIndex(n);
  const pool = endlessPool(n);
  const gap = Math.max(0.4, Math.round((1.4 - n * 0.025) * 100) / 100);
  const batches: WaveEntry[] = [];

  const boss = endlessBossKind(n);
  if (boss) {
    // 25 波之后 BOSS 成双成对,不然后期只靠小怪撑压力
    batches.push({ kind: boss, count: n >= 25 ? 2 : 1, gap: 2.2 });
  }

  // 加一段随波号慢慢漂移的偏移,阵容的循环周期就不会正好卡在 BOSS 的 5 波上
  const batchTotal = endlessBatchCount(n);
  const kinds: MonsterKind[] = [];
  for (let b = 0; b < batchTotal; b++) {
    kinds.push(pool[(n * 2 + b * 3 + Math.floor(n / 5)) % pool.length]);
  }

  // 预算逐批结算:这一批因为取整多出 / 少掉的工作量,下一批补回来。
  // 不这么做的话,「云朵怪那批只能来 1 只」的取整误差会一路留在总量里,
  // 于是第 18 波比第 13 波还轻松,断言「越往后越难」就站不住。
  // 结算顺序按单只工作量从重到轻:大块头的取整误差最大,先算,
  // 后面那些小不点才有足够细的粒度把误差抹平。出场顺序仍按原样。
  const counts = new Map<number, number>();
  const order = kinds.map((kind, b) => b).sort((a, b) => unitLoad(kinds[b], idx) - unitLoad(kinds[a], idx) || a - b);
  let remaining = endlessBudget(n);
  let left = batchTotal;
  for (const b of order) {
    const load = unitLoad(kinds[b], idx);
    const count = Math.max(1, Math.min(ENDLESS_MAX_BATCH, Math.round(remaining / left / load)));
    remaining -= count * load;
    left--;
    counts.set(b, count);
  }
  for (let b = 0; b < batchTotal; b++) batches.push({ kind: kinds[b], count: counts.get(b) ?? 1, gap });
  return batches;
}

/** 撑过第 n 波给的花瓣奖励(波次越深给得越多,经济才追得上血量)。 */
export function endlessClearReward(wave: number): number {
  const n = Math.max(1, Math.round(wave));
  return 3 + Math.floor(n / 3) + (isEndlessBossWave(n) ? 5 : 0);
}

/** 波次标题。 */
export function endlessWaveName(wave: number): string {
  const n = Math.max(1, Math.round(wave));
  const boss = endlessBossKind(n);
  return boss ? `第 ${n} 波 · ${MONSTER_INFO[boss].name}` : `第 ${n} 波`;
}

/** 结算文案:只夸不骂。 */
export function endlessResultLine(wave: number, best: number): string {
  const reached = Math.max(0, Math.round(wave));
  if (reached >= best && reached > 0) return `守到第 ${reached} 波!这是你的新纪录,太厉害啦!`;
  return `守到第 ${reached} 波!最好成绩是第 ${best} 波,再来一次一定能超过!`;
}

/**
 * 一档(默认 5 波)的平均压力。
 * 单看某一波会有起伏——云朵怪那波血厚、飘飘怪那波血薄,这是刻意留的呼吸感;
 * 但一档一档看必须是稳稳往上走的,这才叫「无限递增」。
 */
export function endlessPressure(wave: number, window = ENDLESS_BOSS_EVERY): number {
  const start = Math.max(1, Math.round(wave));
  let sum = 0;
  for (let i = 0; i < window; i++) sum += endlessWaveHp(start + i);
  return sum / window;
}

/** 第 n 波的血量总压力,给单测断言「越来越难」用。 */
export function endlessWaveHp(wave: number): number {
  const n = Math.max(1, Math.round(wave));
  const idx = endlessLevelIndex(n);
  let total = 0;
  for (const e of endlessWave(n)) {
    total += e.count * (monsterHp(e.kind, idx) + MONSTER_INFO[e.kind].armor);
  }
  return total;
}
