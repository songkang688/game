// 绿芽保卫战 —— 纯逻辑函数,不依赖 DOM,方便单独测试。

/* ---------------- 植物 ---------------- */

export type PlantKind = "sparkle" | "bubble" | "nut" | "star";

export const PLANT_INFO: Record<
  PlantKind,
  { cost: number; hp: number; name: string; desc: string }
> = {
  sparkle: { cost: 1, hp: 3, name: "闪光芽", desc: "慢慢攒露珠" },
  bubble: { cost: 2, hp: 4, name: "泡泡芽", desc: "吹泡泡打地上的虫" },
  nut: { cost: 2, hp: 14, name: "果果墩", desc: "圆滚滚,挡住虫虫" },
  star: { cost: 3, hp: 3, name: "星星芽", desc: "星星连飞虫也能打" },
};

export const PLANT_KINDS: PlantKind[] = ["sparkle", "bubble", "nut", "star"];

export const LANES = 4;
export const PLANT_COLS = 8;

export function canAfford(dew: number, kind: PlantKind): boolean {
  return dew >= PLANT_INFO[kind].cost;
}

/** 铲掉植物退回的露珠(半价向上取整)。 */
export function shovelRefund(kind: PlantKind): number {
  return Math.ceil(PLANT_INFO[kind].cost / 2);
}

/* ---------------- 虫虫 ---------------- */

export type BugKind = "walker" | "armor" | "flyer";

export const BUG_INFO: Record<
  BugKind,
  { hp: number; armor: number; speed: number; flying: boolean; name: string }
> = {
  walker: { hp: 3, armor: 0, speed: 0.5, flying: false, name: "爬爬虫" },
  armor: { hp: 3, armor: 3, speed: 0.42, flying: false, name: "壳壳虫" },
  flyer: { hp: 2, armor: 0, speed: 0.66, flying: true, name: "飘飘虫" },
};

/** 虫子血量随关卡加深。 */
export function bugHp(kind: BugKind, level: number): number {
  return BUG_INFO[kind].hp + Math.floor((level - 1) / 2);
}

/** 泡泡打不到飞虫,星星什么都能打。 */
export function projectileCanHit(proj: "bubble" | "star", flying: boolean): boolean {
  return proj === "star" || !flying;
}

/** 伤害先打护甲再掉血;返回新状态和"这一下是否敲碎了护甲"。 */
export function applyDamage(
  bug: { hp: number; armor: number },
  dmg: number,
): { hp: number; armor: number; brokeArmor: boolean } {
  let { hp, armor } = bug;
  let remaining = dmg;
  const hadArmor = armor > 0;
  const used = Math.min(armor, remaining);
  armor -= used;
  remaining -= used;
  hp -= remaining;
  return { hp, armor, brokeArmor: hadArmor && armor === 0 };
}

/* ---------------- 关卡时间表 ---------------- */

export interface BugSpawn {
  time: number;
  lane: number;
  kind: BugKind;
  wave: number;
}

export const LEVEL_COUNT = 5;

/** 每关有几波。 */
export function wavesInLevel(level: number): number {
  return level <= 1 ? 2 : level <= 3 ? 3 : 4;
}

/**
 * 生成某一关(1..5)的确定性出虫时间表。
 * 第 1 关只有爬爬虫;第 2 关起有飘飘虫;第 3 关起有壳壳虫。
 */
export function buildLevelSchedule(level: number): BugSpawn[] {
  const out: BugSpawn[] = [];
  const waves = wavesInLevel(level);
  let clock = 5;
  for (let wi = 0; wi < waves; wi++) {
    const count = 3 + level + wi;
    const gap = Math.max(1.2, 2.4 - level * 0.15 - wi * 0.2);
    for (let i = 0; i < count; i++) {
      let kind: BugKind = "walker";
      if (level >= 3 && i % 5 === 2) kind = "armor";
      else if (level >= 2 && i % 4 === 3) kind = "flyer";
      if (level === 5 && wi === waves - 1 && i % 3 === 1) kind = "armor";
      out.push({
        time: clock + i * gap,
        lane: (i * 3 + wi * 2 + level) % LANES,
        kind,
        wave: wi,
      });
    }
    clock += count * gap + 9;
  }
  return out;
}

/** 泡泡/星星打没打到虫(同车道,x 方向足够近,单位:格)。 */
export function bubbleHitsBug(bubbleX: number, bugX: number, hitRange = 0.3): boolean {
  return Math.abs(bubbleX - bugX) <= hitRange;
}

/** 虫子是否啃到了这一格的植物(单位:格)。 */
export function bugReachesPlant(bugX: number, plantCol: number): boolean {
  return bugX <= plantCol + 0.62 && bugX >= plantCol - 0.1;
}

/** 虫子走到 x <= 这个值就算进家门。 */
export const HOME_X = -0.25;

/* ---------------- 结算 ---------------- */

export function starsForRun(retries: number, plantsLost: number): 1 | 2 | 3 {
  if (retries === 0 && plantsLost <= 2) return 3;
  if (retries <= 1) return 2;
  return 1;
}
