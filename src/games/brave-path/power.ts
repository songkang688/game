/**
 * 勇者小路 1.2 · 战斗数值透明化 与 成长三线（纯函数，不碰 DOM）。
 *
 * 两件事：
 *
 * 一、`resolveFight(attacker, defender)`
 *     把「攻击 / 防御 / 幸运」的对拼写成一个**没有随机数**的纯函数：
 *     暴击按期望值折进每一下的力道，双方轮流出手，算出谁先撑不住。
 *     界面只拿它的三档结论（打得过 / 有点悬 / 打不过）做预判，**不显示具体数字**，
 *     免得小路上的探索变成对着数字表算题。
 *
 * 二、成长三线
 *     · 等级线：关内升级，`logic.ts` 的 `baseHeroStats` 说了算；
 *     · 装备线：关内掉落 / 小摊买的装备，`logic.ts` 的 `GEARS` 说了算；
 *     · 收藏册线：跨游戏、只读的 `src/engine/collection.ts`，本文件负责把它折成战斗加成。
 *     第三条线**硬封顶 +35%**（与 `collection.ts` 的 `BONUS_CAP_PERMILLE` 一致），
 *     绝不允许「攒够收藏册就横着走」。
 */
import { BONUS_CAP_PERMILLE, type CollectionEffects } from "../../engine/collection";
import {
  DEFAULT_CRIT_MULTIPLIER,
  MIN_DAMAGE,
  elementMultiplier,
  type Element
} from "./combat";

// ---------------------------------------------------------------------------
// 一、战斗对拼
// ---------------------------------------------------------------------------

/** `resolveFight` 需要知道的最小信息（`Fighter` 天然满足） */
export interface FightSide {
  name?: string;
  element: Element;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  /** 0..1 */
  crit?: number;
  critMultiplier?: number;
  shield?: number;
}

export interface FightOutcome {
  /** 谁能撑到最后 */
  winner: "attacker" | "defender";
  /** 进攻方要打几下才放倒对方 */
  attackerHits: number;
  /** 防守方要打几下才放倒进攻方 */
  defenderHits: number;
  /** 进攻方每一下的期望力道（已含克制与暴击期望） */
  attackerHit: number;
  defenderHit: number;
  /**
   * 余裕：>0 表示进攻方有富余，越大越轻松；<0 表示打不过。
   * 定义成「双方所需回合数之差 ÷ 较大者」，与双方绝对数值无关，好写阈值。
   */
  margin: number;
}

function num(v: number | undefined, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** 一下能打掉多少（期望值：克制倍率 × 暴击期望，再减防御） */
export function expectedHit(attacker: FightSide, defender: FightSide): number {
  const atk = Math.max(0, num(attacker.atk));
  const def = Math.max(0, num(defender.def));
  const crit = Math.max(0, Math.min(1, num(attacker.crit, 0)));
  const critMul = Math.max(1, num(attacker.critMultiplier, DEFAULT_CRIT_MULTIPLIER));
  const mul = elementMultiplier(attacker.element, defender.element);
  const raw = atk * mul * (1 + crit * (critMul - 1));
  return Math.max(MIN_DAMAGE, Math.round(raw) - def);
}

/** 把星芒 + 护盾折算成「还能挨几下」 */
function hitsToDown(side: FightSide, perHit: number): number {
  const pool = Math.max(1, Math.round(num(side.hp, num(side.maxHp, 1)) + Math.max(0, num(side.shield))));
  return Math.max(1, Math.ceil(pool / Math.max(MIN_DAMAGE, perHit)));
}

/**
 * 一场对拼的结论（纯函数、无随机）。
 * 速度快的先出手，所以回合数相同时速度高的那边赢；速度也一样就算进攻方赢。
 */
export function resolveFight(attacker: FightSide, defender: FightSide): FightOutcome {
  const attackerHit = expectedHit(attacker, defender);
  const defenderHit = expectedHit(defender, attacker);
  const attackerHits = hitsToDown(defender, attackerHit);
  const defenderHits = hitsToDown(attacker, defenderHit);

  const attackerFirst = num(attacker.spd) >= num(defender.spd);
  const winner: FightOutcome["winner"] =
    attackerHits < defenderHits
      ? "attacker"
      : attackerHits > defenderHits
        ? "defender"
        : attackerFirst
          ? "attacker"
          : "defender";

  const span = Math.max(attackerHits, defenderHits);
  const margin = (defenderHits - attackerHits) / span;
  return { winner, attackerHits, defenderHits, attackerHit, defenderHit, margin };
}

/** 三档预判 */
export type Forecast = "easy" | "risky" | "hard";

/** 「有点悬」的余裕区间：低于 -0.12 是打不过，高于 0.22 是打得过 */
export const FORECAST_HARD_BELOW = -0.12;
export const FORECAST_EASY_ABOVE = 0.22;

export const FORECAST_LABELS: Record<Forecast, string> = {
  easy: "打得过",
  risky: "有点悬",
  hard: "打不过"
};

export const FORECAST_EMOJI: Record<Forecast, string> = {
  easy: "🙂",
  risky: "😯",
  hard: "😖"
};

/** 预判提示只讲思路，不报数字 */
export const FORECAST_HINTS: Record<Forecast, string> = {
  easy: "看气势你占上风，稳稳打就行。",
  risky: "势均力敌，先摆个防御看看它的路数，属性挑对了就能翻盘。",
  hard: "它比你壮实不少，换个克它的属性、或者先回去把装备补一补。"
};

/** 由余裕给出三档预判（不给具体数字，保留探索感） */
export function forecastOf(outcome: FightOutcome): Forecast {
  if (outcome.margin <= FORECAST_HARD_BELOW) return "hard";
  if (outcome.margin >= FORECAST_EASY_ABOVE) return "easy";
  return "risky";
}

/** 一步到位：直接给这一对的三档预判 */
export function forecastFight(attacker: FightSide, defender: FightSide): Forecast {
  return forecastOf(resolveFight(attacker, defender));
}

// ---------------------------------------------------------------------------
// 二、成长三线
// ---------------------------------------------------------------------------

export type GrowthLine = "level" | "gear" | "collection";

export const GROWTH_LINE_LABELS: Record<GrowthLine, string> = {
  level: "等级",
  gear: "装备",
  collection: "收藏册"
};

export const GROWTH_LINE_DESC: Record<GrowthLine, string> = {
  level: "关内打怪升上来的，管最基础的星芒和攻防。",
  gear: "关内掉落和小摊买的，管属性和几个显眼的小加成。",
  collection: "跨游戏的收藏册带过来的，只读、温和，最多再多三成半。"
};

/** 收藏册这条线的封顶（千分之一，与 `collection.ts` 完全一致） */
export const COLLECTION_CAP_PERMILLE = BONUS_CAP_PERMILLE;

export interface CollectionCombatBonus {
  /** 攻击加成（千分之一） */
  atk: number;
  /** 防御加成（千分之一） */
  def: number;
  /** 星芒加成（千分之一） */
  maxHp: number;
  /** 暴击率加成（千分之一，直接加在 0..1 的暴击率上） */
  crit: number;
  /** 金币收益加成（千分之一） */
  coins: number;
  /** 五项里最大的那一项，用来盯封顶 */
  peak: number;
}

function permilleOf(mul: number): number {
  const v = typeof mul === "number" && Number.isFinite(mul) ? mul : 1;
  return Math.max(0, Math.round((v - 1) * 1000));
}

function capped(value: number): number {
  return Math.min(COLLECTION_CAP_PERMILLE, Math.max(0, Math.round(value)));
}

/**
 * 把收藏册的通用加成折成本作的战斗加成（只读，绝不回写 collection.ts）：
 * 速度 → 出手更狠（攻击）、弹跳 → 更能扛（防御）、吸金范围 → 更有底气（星芒）、
 * 好运 → 暴击、金币收益 → 金币。每一项都硬夹在 +35% 以内。
 */
export function collectionCombatBonus(effects: CollectionEffects): CollectionCombatBonus {
  const atk = capped(permilleOf(effects.speedMul));
  const def = capped(permilleOf(effects.jumpMul));
  const maxHp = capped(permilleOf(effects.magnetMul));
  const crit = capped(permilleOf(effects.luckMul));
  const coins = capped(permilleOf(effects.coinMul));
  return { atk, def, maxHp, crit, coins, peak: Math.max(atk, def, maxHp, crit, coins) };
}

/** 收藏册这条线折成的乘数（1.12 = 比基础值高 12%） */
export function collectionMultipliers(effects: CollectionEffects): {
  atkMul: number;
  defMul: number;
  hpMul: number;
  coinMul: number;
  critAdd: number;
} {
  const b = collectionCombatBonus(effects);
  return {
    atkMul: 1 + b.atk / 1000,
    defMul: 1 + b.def / 1000,
    hpMul: 1 + b.maxHp / 1000,
    coinMul: 1 + b.coins / 1000,
    critAdd: b.crit / 1000
  };
}

/** 备战小屋里那一行「收藏册带来了什么」的说明；一样都没有就明说 */
export function describeCollectionLine(effects: CollectionEffects): string {
  const b = collectionCombatBonus(effects);
  const parts: string[] = [];
  const pct = (v: number): string => `${(v / 10).toFixed(v % 10 === 0 ? 0 : 1)}%`;
  if (b.atk > 0) parts.push(`攻击 +${pct(b.atk)}`);
  if (b.def > 0) parts.push(`防御 +${pct(b.def)}`);
  if (b.maxHp > 0) parts.push(`星芒 +${pct(b.maxHp)}`);
  if (b.crit > 0) parts.push(`幸运 +${pct(b.crit)}`);
  if (b.coins > 0) parts.push(`金币 +${pct(b.coins)}`);
  return parts.length > 0 ? parts.join("、") : "还没穿上收藏册里的东西，这条线暂时是 0。";
}
