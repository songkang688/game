// 绿芽保卫战 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 18 关守家战役:白天草地 / 黑夜星空 / 水池荷叶,七种植物对七种虫虫。

/* ---------------- 植物 ---------------- */

export type PlantKind =
  | "sparkle" // 闪光芽:攒露珠(经济)
  | "bubble" // 泡泡芽:基础射手
  | "nut" // 果果墩:肉盾墙
  | "star" // 星星芽:连飞虫都能打
  | "ice" // 冰冰花:子弹会减速虫虫
  | "boom" // 爆爆果:虫靠近就轰一大片(一次性)
  | "lily"; // 荷叶垫:铺在水格上,别的植物才能种

export const PLANT_INFO: Record<
  PlantKind,
  { cost: number; hp: number; name: string; desc: string }
> = {
  sparkle: { cost: 1, hp: 3, name: "闪光芽", desc: "慢慢攒露珠" },
  bubble: { cost: 2, hp: 4, name: "泡泡芽", desc: "吹泡泡打地上的虫" },
  nut: { cost: 2, hp: 14, name: "果果墩", desc: "圆滚滚,挡住虫虫" },
  star: { cost: 3, hp: 3, name: "星星芽", desc: "星星连飞虫也能打" },
  ice: { cost: 3, hp: 3, name: "冰冰花", desc: "打中就冻得慢慢的" },
  boom: { cost: 4, hp: 2, name: "爆爆果", desc: "虫靠近就轰一片!" },
  lily: { cost: 1, hp: 6, name: "荷叶垫", desc: "铺水上才能种别的" },
};

export const PLANT_KINDS: PlantKind[] = ["sparkle", "bubble", "nut", "star", "ice", "boom", "lily"];

export const LANES = 4;
export const PLANT_COLS = 8;

export function canAfford(dew: number, kind: PlantKind): boolean {
  return dew >= PLANT_INFO[kind].cost;
}

/** 铲掉植物退回的露珠(半价向上取整)。 */
export function shovelRefund(kind: PlantKind): number {
  return Math.ceil(PLANT_INFO[kind].cost / 2);
}

/** 这一关已解锁的植物(基础 3 种 + 各关新解锁)。 */
export function plantsUnlockedAt(
  levelIdx: number,
  levels: ReadonlyArray<{ unlockPlant?: PlantKind }>,
): PlantKind[] {
  const out: PlantKind[] = ["sparkle", "bubble", "nut"];
  for (let i = 0; i <= Math.min(levelIdx, levels.length - 1); i++) {
    const p = levels[i].unlockPlant;
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** 水格上只能先放荷叶垫;有荷叶后才能放别的植物。 */
export function canPlantOnCell(
  kind: PlantKind,
  isWater: boolean,
  hasLily: boolean,
  hasPlant: boolean,
): boolean {
  if (kind === "lily") return isWater && !hasLily;
  if (hasPlant) return false;
  if (isWater) return hasLily;
  return true;
}

/* ---------------- 虫虫 ---------------- */

export type BugKind =
  | "walker" // 爬爬虫:基础
  | "flyer" // 飘飘虫:会飞,泡泡打不到
  | "armor" // 壳壳虫:有护甲
  | "speedy" // 冲冲虫:飞快
  | "digger" // 钻钻虫:会跳过遇到的第一棵植物
  | "bucket" // 桶桶虫:重甲慢吞吞
  | "bossbug"; // 大虫王:超厚血,啃得飞快

export const BUG_INFO: Record<
  BugKind,
  { hp: number; armor: number; speed: number; flying: boolean; jumps: boolean; name: string; boss: boolean }
> = {
  walker: { hp: 3, armor: 0, speed: 0.5, flying: false, jumps: false, name: "爬爬虫", boss: false },
  flyer: { hp: 2, armor: 0, speed: 0.66, flying: true, jumps: false, name: "飘飘虫", boss: false },
  armor: { hp: 3, armor: 3, speed: 0.42, flying: false, jumps: false, name: "壳壳虫", boss: false },
  speedy: { hp: 2, armor: 0, speed: 0.95, flying: false, jumps: false, name: "冲冲虫", boss: false },
  digger: { hp: 3, armor: 0, speed: 0.55, flying: false, jumps: true, name: "钻钻虫", boss: false },
  bucket: { hp: 4, armor: 6, speed: 0.34, flying: false, jumps: false, name: "桶桶虫", boss: false },
  bossbug: { hp: 40, armor: 4, speed: 0.24, flying: false, jumps: false, name: "大虫王", boss: true },
};

/** 虫子血量随关卡(0 起)加深。 */
export function bugHp(kind: BugKind, levelIdx: number): number {
  return BUG_INFO[kind].hp + Math.floor(levelIdx / 4);
}

/** 泡泡打不到飞虫,星星和冰冰什么都能打。 */
export function projectileCanHit(proj: "bubble" | "star" | "ice", flying: boolean): boolean {
  return proj !== "bubble" || !flying;
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

/** 冰冻减速:冻住时速度打五折。 */
export const ICE_SLOW = 0.5;
export const ICE_SECONDS = 2.2;
/** 爆爆果:触发距离(格)与波及范围(格)。 */
export const BOOM_TRIGGER = 0.55;
export const BOOM_RANGE = 1.6;
export const BOOM_DAMAGE = 10;

/* ---------------- 关卡 ---------------- */

export interface WaveEntry {
  kind: BugKind;
  count: number;
  gap: number;
}

export interface LevelDef {
  name: string;
  /** 场景:day 白天 / night 夜晚(露珠攒得慢) / pool 有水路 */
  scene: "day" | "night" | "pool";
  /** 水路车道(只在 pool 场景) */
  waterLanes: number[];
  waves: WaveEntry[][];
  /** 旗帜大波的波次下标(超大规模,有横幅) */
  flagWaves: number[];
  startDew: number;
  unlockPlant?: PlantKind;
  /** 本关独特机制标记(测试用) */
  feature: string;
  hint: string;
}

export const LEVELS: LevelDef[] = [
  {
    name: "小院第一步", scene: "day", waterLanes: [], startDew: 4, feature: "入门教学",
    hint: "先选卡再点格子种植物,别让虫虫进小屋!",
    flagWaves: [],
    waves: [
      [{ kind: "walker", count: 4, gap: 2.2 }],
      [{ kind: "walker", count: 6, gap: 1.8 }],
    ],
  },
  {
    name: "飞虫来袭", scene: "day", waterLanes: [], startDew: 5, unlockPlant: "star", feature: "飘飘虫登场",
    hint: "飘飘虫会飞,泡泡打不到,快种星星芽!",
    flagWaves: [],
    waves: [
      [{ kind: "walker", count: 4, gap: 2.0 }, { kind: "flyer", count: 2, gap: 1.6 }],
      [{ kind: "flyer", count: 3, gap: 1.6 }, { kind: "walker", count: 4, gap: 1.6 }],
    ],
  },
  {
    name: "硬壳小队", scene: "day", waterLanes: [], startDew: 5, feature: "壳壳虫护甲",
    hint: "壳壳虫有硬壳,要先敲碎再掉血!",
    flagWaves: [],
    waves: [
      [{ kind: "armor", count: 2, gap: 2.4 }, { kind: "walker", count: 4, gap: 1.8 }],
      [{ kind: "armor", count: 3, gap: 2.0 }, { kind: "flyer", count: 2, gap: 1.6 }],
      [{ kind: "armor", count: 3, gap: 1.8 }, { kind: "walker", count: 5, gap: 1.4 }],
    ],
  },
  {
    name: "冰冰花园", scene: "day", waterLanes: [], startDew: 6, unlockPlant: "ice", feature: "冰冰花+冲冲虫",
    hint: "冲冲虫跑得快!新植物冰冰花能把它冻慢",
    flagWaves: [],
    waves: [
      [{ kind: "speedy", count: 3, gap: 1.8 }, { kind: "walker", count: 4, gap: 1.6 }],
      [{ kind: "speedy", count: 4, gap: 1.4 }, { kind: "flyer", count: 3, gap: 1.5 }],
      [{ kind: "speedy", count: 5, gap: 1.2 }, { kind: "armor", count: 2, gap: 2.0 }],
    ],
  },
  {
    name: "第一面大旗", scene: "day", waterLanes: [], startDew: 6, feature: "旗帜大波登场",
    hint: "看到大旗就是超大一波!提前摆好阵",
    flagWaves: [2],
    waves: [
      [{ kind: "walker", count: 5, gap: 1.6 }, { kind: "flyer", count: 2, gap: 1.6 }],
      [{ kind: "armor", count: 3, gap: 1.8 }, { kind: "speedy", count: 3, gap: 1.3 }],
      [{ kind: "walker", count: 6, gap: 1.0 }, { kind: "flyer", count: 3, gap: 1.2 }, { kind: "armor", count: 3, gap: 1.4 }],
    ],
  },
  {
    name: "夜幕降临", scene: "night", waterLanes: [], startDew: 7, feature: "夜间露珠稀少",
    hint: "晚上露珠攒得慢,多种几棵闪光芽!",
    flagWaves: [2],
    waves: [
      [{ kind: "walker", count: 5, gap: 1.6 }],
      [{ kind: "flyer", count: 4, gap: 1.4 }, { kind: "walker", count: 4, gap: 1.5 }],
      [{ kind: "armor", count: 4, gap: 1.5 }, { kind: "speedy", count: 4, gap: 1.2 }],
    ],
  },
  {
    name: "钻钻夜行队", scene: "night", waterLanes: [], startDew: 7, unlockPlant: "boom", feature: "钻钻虫跳墙",
    hint: "钻钻虫会跳过第一棵植物!爆爆果轰它",
    flagWaves: [2],
    waves: [
      [{ kind: "digger", count: 3, gap: 2.0 }, { kind: "walker", count: 4, gap: 1.6 }],
      [{ kind: "digger", count: 4, gap: 1.6 }, { kind: "flyer", count: 3, gap: 1.4 }],
      [{ kind: "digger", count: 5, gap: 1.3 }, { kind: "armor", count: 3, gap: 1.6 }],
    ],
  },
  {
    name: "小虫王驾到", scene: "day", waterLanes: [], startDew: 8, feature: "章节小BOSS",
    hint: "大块头来啦!它啃得特别快,集中火力!",
    flagWaves: [2],
    waves: [
      [{ kind: "walker", count: 5, gap: 1.4 }, { kind: "speedy", count: 3, gap: 1.2 }],
      [{ kind: "armor", count: 3, gap: 1.6 }, { kind: "digger", count: 3, gap: 1.6 }],
      [{ kind: "bossbug", count: 1, gap: 1 }, { kind: "flyer", count: 4, gap: 1.2 }],
    ],
  },
  {
    name: "水池初见", scene: "pool", waterLanes: [1, 2], startDew: 7, unlockPlant: "lily", feature: "水路荷叶",
    hint: "中间两条是水!先铺荷叶垫才能种植物",
    flagWaves: [2],
    waves: [
      [{ kind: "walker", count: 5, gap: 1.6 }],
      [{ kind: "walker", count: 5, gap: 1.4 }, { kind: "flyer", count: 3, gap: 1.4 }],
      [{ kind: "speedy", count: 4, gap: 1.2 }, { kind: "armor", count: 3, gap: 1.5 }],
    ],
  },
  {
    name: "桶桶虫渡河", scene: "pool", waterLanes: [1, 2], startDew: 8, feature: "桶桶虫重甲",
    hint: "桶桶虫的铁桶超级硬,冰冻+集火!",
    flagWaves: [2],
    waves: [
      [{ kind: "bucket", count: 2, gap: 3.0 }, { kind: "walker", count: 4, gap: 1.5 }],
      [{ kind: "bucket", count: 2, gap: 2.6 }, { kind: "flyer", count: 4, gap: 1.3 }],
      [{ kind: "bucket", count: 3, gap: 2.2 }, { kind: "speedy", count: 4, gap: 1.1 }],
    ],
  },
  {
    name: "月光池塘", scene: "night", waterLanes: [], startDew: 8, feature: "夜战混合潮",
    hint: "夜里什么虫都有,冰冰花配爆爆果!",
    flagWaves: [3],
    waves: [
      [{ kind: "walker", count: 5, gap: 1.4 }, { kind: "digger", count: 2, gap: 1.8 }],
      [{ kind: "armor", count: 3, gap: 1.5 }, { kind: "flyer", count: 4, gap: 1.2 }],
      [{ kind: "bucket", count: 2, gap: 2.4 }, { kind: "speedy", count: 4, gap: 1.1 }],
      [{ kind: "walker", count: 6, gap: 0.9 }, { kind: "digger", count: 3, gap: 1.4 }, { kind: "flyer", count: 3, gap: 1.2 }],
    ],
  },
  {
    name: "冲冲快潮", scene: "day", waterLanes: [], startDew: 8, feature: "极速虫潮",
    hint: "全是飞毛腿!冰冰花是你最好的朋友",
    flagWaves: [2],
    waves: [
      [{ kind: "speedy", count: 5, gap: 1.2 }, { kind: "flyer", count: 3, gap: 1.3 }],
      [{ kind: "speedy", count: 6, gap: 1.0 }, { kind: "digger", count: 3, gap: 1.5 }],
      [{ kind: "speedy", count: 8, gap: 0.8 }, { kind: "flyer", count: 4, gap: 1.0 }],
    ],
  },
  {
    name: "钻钻大军", scene: "night", waterLanes: [], startDew: 9, feature: "跳墙大军",
    hint: "一大群钻钻虫!果果墩后面再藏一排",
    flagWaves: [2],
    waves: [
      [{ kind: "digger", count: 4, gap: 1.6 }, { kind: "walker", count: 4, gap: 1.4 }],
      [{ kind: "digger", count: 5, gap: 1.3 }, { kind: "armor", count: 3, gap: 1.5 }],
      [{ kind: "digger", count: 6, gap: 1.0 }, { kind: "bucket", count: 2, gap: 2.4 }],
    ],
  },
  {
    name: "双旗大波", scene: "pool", waterLanes: [1, 2], startDew: 9, feature: "连续两面大旗",
    hint: "这一关有两面大旗!中间别松劲",
    flagWaves: [1, 3],
    waves: [
      [{ kind: "walker", count: 5, gap: 1.4 }, { kind: "flyer", count: 3, gap: 1.3 }],
      [{ kind: "speedy", count: 5, gap: 1.0 }, { kind: "armor", count: 4, gap: 1.3 }],
      [{ kind: "digger", count: 4, gap: 1.4 }, { kind: "bucket", count: 2, gap: 2.4 }],
      [{ kind: "walker", count: 6, gap: 0.9 }, { kind: "bucket", count: 2, gap: 2.2 }, { kind: "flyer", count: 4, gap: 1.0 }],
    ],
  },
  {
    name: "全虫总动员", scene: "day", waterLanes: [], startDew: 9, feature: "全部虫种混战",
    hint: "六种虫一起上!用上你学会的所有植物",
    flagWaves: [3],
    waves: [
      [{ kind: "walker", count: 4, gap: 1.4 }, { kind: "speedy", count: 3, gap: 1.2 }],
      [{ kind: "armor", count: 3, gap: 1.4 }, { kind: "digger", count: 3, gap: 1.4 }],
      [{ kind: "bucket", count: 2, gap: 2.2 }, { kind: "flyer", count: 4, gap: 1.1 }],
      [{ kind: "speedy", count: 5, gap: 0.9 }, { kind: "armor", count: 3, gap: 1.3 }, { kind: "digger", count: 3, gap: 1.3 }],
    ],
  },
  {
    name: "夜行军团", scene: "night", waterLanes: [], startDew: 10, feature: "夜间车轮战五波",
    hint: "整整 5 波!波与波之间抓紧补种",
    flagWaves: [4],
    waves: [
      [{ kind: "walker", count: 5, gap: 1.3 }],
      [{ kind: "flyer", count: 5, gap: 1.1 }],
      [{ kind: "digger", count: 4, gap: 1.3 }, { kind: "speedy", count: 3, gap: 1.1 }],
      [{ kind: "armor", count: 4, gap: 1.3 }, { kind: "bucket", count: 2, gap: 2.2 }],
      [{ kind: "walker", count: 6, gap: 0.8 }, { kind: "speedy", count: 5, gap: 0.9 }, { kind: "flyer", count: 4, gap: 1.0 }],
    ],
  },
  {
    name: "水陆大混战", scene: "pool", waterLanes: [0, 3], startDew: 10, feature: "上下都是水路",
    hint: "最上最下都是水!荷叶要铺够",
    flagWaves: [3],
    waves: [
      [{ kind: "walker", count: 5, gap: 1.3 }, { kind: "flyer", count: 3, gap: 1.2 }],
      [{ kind: "speedy", count: 5, gap: 1.0 }, { kind: "digger", count: 3, gap: 1.4 }],
      [{ kind: "bucket", count: 3, gap: 2.0 }, { kind: "armor", count: 3, gap: 1.3 }],
      [{ kind: "speedy", count: 6, gap: 0.8 }, { kind: "bucket", count: 2, gap: 2.0 }, { kind: "flyer", count: 4, gap: 0.9 }],
    ],
  },
  {
    name: "大虫王决战", scene: "night", waterLanes: [], startDew: 11, feature: "最终BOSS大虫王",
    hint: "最终决战!大虫王带着全军来了!",
    flagWaves: [3],
    waves: [
      [{ kind: "walker", count: 5, gap: 1.2 }, { kind: "digger", count: 3, gap: 1.3 }],
      [{ kind: "armor", count: 4, gap: 1.2 }, { kind: "speedy", count: 4, gap: 1.0 }],
      [{ kind: "bucket", count: 3, gap: 1.8 }, { kind: "flyer", count: 5, gap: 0.9 }],
      [{ kind: "bossbug", count: 1, gap: 1 }, { kind: "walker", count: 6, gap: 0.9 }, { kind: "flyer", count: 4, gap: 1.0 }],
    ],
  },
];

export interface BugSpawn {
  time: number;
  lane: number;
  kind: BugKind;
  wave: number;
}

/** 把一关的波次定义摊成确定性的出虫时间表。 */
export function buildLevelSchedule(levelIdx: number): BugSpawn[] {
  const def = LEVELS[levelIdx];
  const out: BugSpawn[] = [];
  let clock = 5;
  for (let wi = 0; wi < def.waves.length; wi++) {
    const isFlag = def.flagWaves.includes(wi);
    let i = 0;
    let waveEnd = clock;
    for (const entry of def.waves[wi]) {
      for (let k = 0; k < entry.count; k++) {
        const t = clock + k * entry.gap;
        out.push({
          time: t,
          lane: (i * 3 + wi * 2 + levelIdx) % LANES,
          kind: entry.kind,
          wave: wi,
        });
        waveEnd = Math.max(waveEnd, t);
        i++;
      }
      clock += 1.2;
    }
    clock = waveEnd + (isFlag ? 11 : 9);
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

export function levelBugCount(def: LevelDef): number {
  return def.waves.reduce((s, w) => s + w.reduce((x, e) => x + e.count, 0), 0);
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

/** 夜晚露珠攒得慢。 */
export const PASSIVE_DEW_DAY = 3.5;
export const PASSIVE_DEW_NIGHT = 6.5;

export function passiveDewInterval(scene: "day" | "night" | "pool"): number {
  return scene === "night" ? PASSIVE_DEW_NIGHT : PASSIVE_DEW_DAY;
}

/* ---------------- 结算与进度 ---------------- */

/** 单关星级:损失 ≤1 棵植物 3 星,≤4 棵 2 星,守住 1 星。 */
export function starsForLevel(plantsLost: number): 1 | 2 | 3 {
  if (plantsLost <= 1) return 3;
  if (plantsLost <= 4) return 2;
  return 1;
}

export const PROGRESS_KEY = "yiduo-yixing.sprout-defense.campaign.v1";

export function parseProgress(raw: string | null, count: number): number[] {
  const out = new Array<number>(count).fill(0);
  if (!raw) return out;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) {
      for (let i = 0; i < Math.min(arr.length, count); i++) {
        const v = arr[i];
        if (typeof v === "number") out[i] = Math.max(0, Math.min(3, Math.round(v)));
      }
    }
  } catch {
    // 坏档当新档
  }
  return out;
}

export function serializeProgress(stars: ReadonlyArray<number>): string {
  return JSON.stringify(stars);
}

export function isLevelUnlocked(stars: ReadonlyArray<number>, idx: number): boolean {
  if (idx <= 0) return true;
  return (stars[idx - 1] ?? 0) > 0;
}

export function totalStars(stars: ReadonlyArray<number>): number {
  return stars.reduce((s, v) => s + v, 0);
}
