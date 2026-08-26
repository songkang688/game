/**
 * 接住小水果 · 188 关关卡表。
 * 前 99 关是 1.0 的六种天气，生成参数一个字都没动；
 * 1.1 在末尾追加四条新果道（第 100–188 关）：
 *  ⑦双篮果谷=左右两只篮子镜像动  ⑧沉甸果坡=沉水果掉得快还压慢篮子
 *  ⑨传送果道=水果先上传送带滑一段  ⑩连击星光坡=连续接住攒连击倍率
 * 1.0 的六个主题章节、六种天气机关（并非同一模板）：
 *  ①果园清晨=纯接水果  ②淘气乌鸦=乌鸦丢炸弹  ③金色午后=金星星一颗顶两颗
 *  ④大风天=水果被风吹得左右飘  ⑤雷雨天=躲雨滴+掉得快  ⑥夜晚萤火=萤火虫一只顶三个
 */
import type { Chapter } from "../level99";

/** 1.0 的六种天气：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新果道从这里开始往后排） */
export const LEGACY_LEVELS = 99;

export interface CatchLevel {
  target: number;
  speed: number;
  spawnMs: number;
  /** 坏东西出现概率（接到会掉一颗爱心） */
  badChance: number;
  /** 金色奖励出现概率 */
  goldChance: number;
  /** 风力：0 = 无风，越大飘得越厉害 */
  wind: number;
  /** 主题（决定水果 / 坏东西 / 背景） */
  theme: number;
  /** 1.1 篮子数（2 = 左右各一只、镜像移动），前 99 关不带（等于 1） */
  baskets?: number;
  /** 1.1 沉水果概率（掉得快、接住 +2 但篮子会变慢一下），前 99 关不带 */
  heavyChance?: number;
  /** 1.1 传送带速度（像素/秒，正右负左；0/不带 = 没有），前 99 关不带 */
  conveyor?: number;
  /** 1.1 连击倍率：连续接住攒连击，满 5 连击多算一颗，前 99 关不带 */
  combo?: boolean;
  /** 1.2 小辣椒概率（掉得最慢、红红的，接到掉一颗爱心），前 99 关不带 */
  chiliChance?: number;
  /** 1.2 冰冻果概率（接住定住 2 秒），前 99 关不带 */
  freezeChance?: number;
  /** 1.2 磁铁果概率（接住 3 秒里篮口变大），前 99 关不带 */
  magnetChance?: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "果园清晨", emoji: "🍎", color: "#FFF4D6", desc: "接住掉下来的水果，装满篮子！", size: 17 },
  { name: "淘气乌鸦", emoji: "🐦‍⬛", color: "#EDE7DA", desc: "乌鸦丢炸弹啦，千万别接到！", size: 17 },
  { name: "金色午后", emoji: "🌟", color: "#FFEFC2", desc: "金星星一颗顶两颗，专挑亮的接！", size: 17 },
  { name: "大风天", emoji: "🍃", color: "#DDF3E4", desc: "呼呼～水果被风吹得左右飘！", size: 16 },
  { name: "雷雨天", emoji: "⛈️", color: "#DCE7F5", desc: "雨滴凉凉的别接到，水果掉得更快！", size: 16 },
  { name: "夜晚萤火", emoji: "🌙", color: "#E3DFF5", desc: "夜里的萤火虫一只顶三个！", size: 16 },
  // ↓ 1.1 追加：四条新果道，合计 89 关
  { name: "双篮果谷", emoji: "🧺", color: "#E8F5DA", desc: "左右各一只篮子，镜像着一起动，两边都要照顾！", size: 23 },
  { name: "沉甸果坡", emoji: "🍉", color: "#FFE8CE", desc: "沉水果掉得快，接住顶两颗，可篮子会被压慢！", size: 22 },
  { name: "传送果道", emoji: "🛝", color: "#D9ECFF", desc: "水果先在半空的传送带上滑一段，看准落点！", size: 22 },
  { name: "连击星光坡", emoji: "🌠", color: "#E6DFF5", desc: "连续接住攒连击，攒满 5 连击多算一颗！", size: 22 }
];

export const THEME_SETS = [
  { fruits: ["🍎", "🍌", "🍓", "🍇", "🍑", "🍊"], bad: "💣", gold: "🌟", bg: "linear-gradient(180deg, #CDEBFF 0%, #EAF8E6 100%)" },
  { fruits: ["🍎", "🍐", "🍒", "🍉", "🥝", "🍋"], bad: "💣", gold: "🌟", bg: "linear-gradient(180deg, #D8E8F5 0%, #EFE9D8 100%)" },
  { fruits: ["🍊", "🥭", "🍍", "🍑", "🍯", "🧁"], bad: "💣", gold: "🌟", bg: "linear-gradient(180deg, #FFE8B0 0%, #FFF6DF 100%)" },
  { fruits: ["🍏", "🍐", "🍇", "🍈", "🫐", "🍒"], bad: "🌰", gold: "🌟", bg: "linear-gradient(180deg, #CFF0DC 0%, #F2FBE8 100%)" },
  { fruits: ["🍎", "🍌", "🍇", "🍓", "🍊", "🍉"], bad: "💧", gold: "🌟", bg: "linear-gradient(180deg, #B9CCE4 0%, #DDE8F2 100%)" },
  { fruits: ["🏮", "🍡", "🥮", "🍬", "🍭", "🍪"], bad: "🦇", gold: "✨", bg: "linear-gradient(180deg, #4A5590 0%, #8A7AB0 100%)" },
  // ↓ 1.1 追加：四条新果道的主题
  { fruits: ["🍎", "🍊", "🍇", "🍐", "🍒", "🥝"], bad: "💣", gold: "🌟", bg: "linear-gradient(180deg, #DFF3D8 0%, #FFE9F0 100%)" },
  { fruits: ["🍏", "🍋", "🍓", "🍑", "🍍", "🥭"], bad: "🪨", gold: "🌟", bg: "linear-gradient(180deg, #FFE3C4 0%, #FFF4E0 100%)" },
  { fruits: ["🍎", "🍌", "🍇", "🍊", "🍒", "🫐"], bad: "🧊", gold: "🌟", bg: "linear-gradient(180deg, #D6ECFF 0%, #EAF6FF 100%)" },
  { fruits: ["🍇", "🍒", "🍊", "🍎", "🥝", "🍓"], bad: "🌵", gold: "✨", bg: "linear-gradient(180deg, #56618F 0%, #9B8CC4 100%)" }
] as const;

/** 1.1 沉甸果坡的沉水果（接住 +2，但篮子会被压慢一小会儿） */
export const HEAVY_FRUITS = ["🍉", "🎃", "🥥", "🍈"] as const;

function buildLevel(ci: number, t: number): CatchLevel {
  switch (ci) {
    case 0:
      return {
        target: 8 + t, speed: 0.9 + t * 0.03,
        spawnMs: 1150 - t * 15, badChance: 0, goldChance: 0.06,
        wind: 0, theme: 0
      };
    case 1:
      return {
        target: 10 + t, speed: 1.0 + t * 0.03,
        spawnMs: 1050 - t * 15, badChance: 0.1 + t * 0.008, goldChance: 0.06,
        wind: 0, theme: 1
      };
    case 2:
      return {
        target: 14 + t, speed: 1.1 + t * 0.03,
        spawnMs: 980 - t * 15, badChance: 0.1, goldChance: 0.14 + t * 0.004,
        wind: 0, theme: 2
      };
    case 3:
      return {
        target: 12 + t, speed: 1.1 + t * 0.03,
        spawnMs: 950 - t * 12, badChance: 0.08, goldChance: 0.08,
        wind: 0.5 + t * 0.05, theme: 3
      };
    case 4:
      return {
        target: 13 + t, speed: 1.3 + t * 0.03,
        spawnMs: 850 - t * 12, badChance: 0.16 + t * 0.006, goldChance: 0.07,
        wind: 0, theme: 4
      };
    case 5:
      return {
        target: 15 + t, speed: 1.35 + t * 0.03,
        spawnMs: 800 - t * 12, badChance: 0.16, goldChance: 0.1,
        wind: 0.3 + t * 0.03, theme: 5
      };
    case 6:
      // 双篮果谷：两只篮子镜像动，坏东西少一点作补偿；1.2 起中段开始掉冰冻果
      return {
        target: 14 + Math.floor(t / 2), speed: 1.0 + t * 0.02,
        spawnMs: 1000 - t * 10, badChance: 0.08 + t * 0.004, goldChance: 0.08,
        wind: 0, theme: 6, baskets: 2,
        freezeChance: t >= 8 ? 0.05 : 0
      };
    case 7:
      // 沉甸果坡：沉水果掉得快、顶两颗，但篮子会被压慢；1.2 起给磁铁果当补偿
      return {
        target: 16 + Math.floor(t / 2), speed: 1.05 + t * 0.02,
        spawnMs: 950 - t * 10, badChance: 0.1, goldChance: 0.06,
        wind: 0, theme: 7, heavyChance: 0.18 + t * 0.005,
        magnetChance: t >= 6 ? 0.06 : 0
      };
    case 8:
      // 传送果道：水果先在半空传送带上滑一段，方向逐关轮换；1.2 起传送带上会混进小辣椒
      return {
        target: 14 + Math.floor(t / 2), speed: 1.05 + t * 0.02,
        spawnMs: 950 - t * 10, badChance: 0.1, goldChance: 0.07,
        wind: 0, theme: 8, conveyor: (t % 2 === 0 ? 1 : -1) * (46 + t * 2),
        chiliChance: t >= 4 ? 0.05 + t * 0.002 : 0,
        freezeChance: t >= 10 ? 0.05 : 0
      };
    default:
      // 连击星光坡：连击倍率 + 后段混入风和沉水果；1.2 起五种水果道具在这里全员登场
      return {
        target: 18 + Math.floor(t / 2), speed: 1.1 + t * 0.02,
        spawnMs: 900 - t * 10, badChance: 0.12 + t * 0.004, goldChance: 0.07,
        wind: t >= 12 ? 0.3 : 0, theme: 9, combo: true,
        heavyChance: t >= 16 ? 0.1 : 0,
        chiliChance: 0.05, freezeChance: 0.05, magnetChance: 0.05
      };
  }
}

export const LEVELS: CatchLevel[] = (() => {
  const out: CatchLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();
