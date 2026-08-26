/**
 * 接住小水果 · 99 关关卡表。
 * 六个主题章节、六种天气机关（并非同一模板）：
 *  ①果园清晨=纯接水果  ②淘气乌鸦=乌鸦丢炸弹  ③金色午后=金星星一颗顶两颗
 *  ④大风天=水果被风吹得左右飘  ⑤雷雨天=躲雨滴+掉得快  ⑥夜晚萤火=萤火虫一只顶三个
 */
import type { Chapter } from "../level99";

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
}

export const CHAPTERS: Chapter[] = [
  { name: "果园清晨", emoji: "🍎", color: "#FFF4D6", desc: "接住掉下来的水果，装满篮子！", size: 17 },
  { name: "淘气乌鸦", emoji: "🐦‍⬛", color: "#EDE7DA", desc: "乌鸦丢炸弹啦，千万别接到！", size: 17 },
  { name: "金色午后", emoji: "🌟", color: "#FFEFC2", desc: "金星星一颗顶两颗，专挑亮的接！", size: 17 },
  { name: "大风天", emoji: "🍃", color: "#DDF3E4", desc: "呼呼～水果被风吹得左右飘！", size: 16 },
  { name: "雷雨天", emoji: "⛈️", color: "#DCE7F5", desc: "雨滴凉凉的别接到，水果掉得更快！", size: 16 },
  { name: "夜晚萤火", emoji: "🌙", color: "#E3DFF5", desc: "夜里的萤火虫一只顶三个！", size: 16 }
];

export const THEME_SETS = [
  { fruits: ["🍎", "🍌", "🍓", "🍇", "🍑", "🍊"], bad: "💣", badName: "炸弹", gold: "🌟", goldName: "金星星", bg: "linear-gradient(180deg, #CDEBFF 0%, #EAF8E6 100%)" },
  { fruits: ["🍎", "🍐", "🍒", "🍉", "🥝", "🍋"], bad: "💣", badName: "乌鸦丢的炸弹", gold: "🌟", goldName: "金星星", bg: "linear-gradient(180deg, #D8E8F5 0%, #EFE9D8 100%)" },
  { fruits: ["🍊", "🥭", "🍍", "🍑", "🍯", "🧁"], bad: "💣", badName: "炸弹", gold: "🌟", goldName: "金星星", bg: "linear-gradient(180deg, #FFE8B0 0%, #FFF6DF 100%)" },
  { fruits: ["🍏", "🍐", "🍇", "🍈", "🫐", "🍒"], bad: "🌰", badName: "硬栗子", gold: "🌟", goldName: "金星星", bg: "linear-gradient(180deg, #CFF0DC 0%, #F2FBE8 100%)" },
  { fruits: ["🍎", "🍌", "🍇", "🍓", "🍊", "🍉"], bad: "💧", badName: "凉雨滴", gold: "🌟", goldName: "金星星", bg: "linear-gradient(180deg, #B9CCE4 0%, #DDE8F2 100%)" },
  { fruits: ["🏮", "🍡", "🥮", "🍬", "🍭", "🍪"], bad: "🦇", badName: "小蝙蝠", gold: "✨", goldName: "萤火虫", bg: "linear-gradient(180deg, #4A5590 0%, #8A7AB0 100%)" }
] as const;

/**
 * 进关目标朗读（一年级识字量有限，关卡目标与机关提示靠听）。
 * 与画面上的小字提示同源同逻辑，纯函数便于测试。
 */
export function goalSpeechLine(cfg: CatchLevel): string {
  const th = THEME_SETS[cfg.theme];
  const parts = [`接住 ${cfg.target} 个${cfg.theme === 5 ? "小点心" : "水果"}，装满篮子！`];
  if (cfg.badChance > 0) parts.push(`小心，${th.badName}不能接！`);
  if (cfg.goldChance >= 0.1) parts.push(`${th.goldName}一颗顶${cfg.theme === 5 ? "三" : "两"}颗！`);
  if (cfg.wind > 0) parts.push("有风，水果会飘！");
  return parts.join("");
}

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
    default:
      return {
        target: 15 + t, speed: 1.35 + t * 0.03,
        spawnMs: 800 - t * 12, badChance: 0.16, goldChance: 0.1,
        wind: 0.3 + t * 0.03, theme: 5
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
