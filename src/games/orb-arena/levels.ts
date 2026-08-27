/**
 * 圆圆大作战 · 188 关战役配置(纯数据 + 纯函数)。
 * 十章把 IO 竞技场的技术点一个一个拆开教:先吞噬,再刺球,再分身、孢子、合并、缩圈。
 */
import { TOTAL_LEVELS, type Chapter } from "../level99";

export const CHAPTERS: Chapter[] = [
  { name: "彩豆平原", emoji: "🟢", color: "#DFF5DC", desc: "只有彩豆和很小的对手,先把吞噬和边界摸熟。", size: 20 },
  { name: "刺球花园", emoji: "🦔", color: "#FDE7D6", desc: "刺球登场:先学会绕开,再学会够大了才去碰。", size: 20 },
  { name: "分身训练营", emoji: "✂️", color: "#DCE9FB", desc: "门后的小圆只有分身才够得着。", size: 20 },
  { name: "孢子工坊", emoji: "💧", color: "#E9E1FB", desc: "吐孢子喂刺球,把刺球推到对手那边去。", size: 18 },
  { name: "双圆合并岛", emoji: "🔗", color: "#FBE3EE", desc: "先分开绕过墙,再等合并窗口并回来。", size: 18 },
  { name: "排行赛场", emoji: "🏅", color: "#FDF3D2", desc: "限时冲名次:进前三,或者干脆拿第一。", size: 20 },
  { name: "缩圈荒原", emoji: "🌀", color: "#D8EFF2", desc: "安全区一直在收,别贪最后那颗彩豆。", size: 18 },
  { name: "团团合作谷", emoji: "🤝", color: "#E2F3E6", desc: "有队友一起打,别把队友最后一颗圆吃掉。", size: 18 },
  { name: "夜色迷雾", emoji: "🌙", color: "#DEDCF2", desc: "视野变小,靠小地图雷达找路。", size: 18 },
  { name: "圆圆杯总决赛", emoji: "🏆", color: "#F7DDE8", desc: "全部机制一起上,对手又多又刁。", size: 18 }
];

export interface OrbLevel {
  /** 0 基关号 */
  level: number;
  mapW: number;
  mapH: number;
  /** 场上彩豆数 */
  pellets: number;
  /** 刺球数 */
  viruses: number;
  /** 本地 AI 对手数 */
  bots: number;
  /** 对手档位 */
  botTier: "rookie" | "normal" | "pro" | "hell";
  /** 目标质量:达到就过关 */
  targetMass: number;
  /** 限时(秒) */
  timeSec: number;
  /** 缩圈速度(像素/秒),0 表示不缩圈 */
  shrink: number;
  /** 有没有队友 */
  ally: boolean;
  /** 视野是不是变窄了 */
  fog: boolean;
}

/** 关号 → 章节下标 */
export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

/** 每一关的配置:同一关每次进来都一样,难度沿关号平滑上升 */
export function levelConfig(level: number): OrbLevel {
  const lv = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(level)));
  const ci = chapterIndexOf(lv);
  const inCh = lv - CHAPTERS.slice(0, ci).reduce((s, c) => s + c.size, 0);
  const ramp = inCh / Math.max(1, CHAPTERS[ci].size - 1);

  const size = 1200 + ci * 180 + Math.round(ramp * 160);
  const bots = Math.min(11, Math.max(1, Math.round(1 + ci * 1.05 + ramp * 1.6)));
  const tier: OrbLevel["botTier"] =
    ci >= 9 ? "hell" : ci >= 6 ? "pro" : ci >= 3 ? "normal" : "rookie";

  return {
    level: lv,
    mapW: size,
    mapH: size,
    pellets: 90 + ci * 14 + Math.round(ramp * 20),
    viruses: ci === 0 ? 0 : Math.min(10, 1 + Math.round(ci * 0.9 + ramp)),
    bots,
    botTier: tier,
    targetMass: 90 + ci * 42 + Math.round(ramp * 46),
    timeSec: 75 + ci * 6 + Math.round(ramp * 12),
    shrink: ci === 6 || ci === 9 ? 6 + ramp * 5 : 0,
    ally: ci === 7,
    fog: ci === 8 || ci === 9
  };
}

/** 无尽模式第 n 波的配置:密度和缩圈速度一直往上走 */
/**
 * 无尽的收圈速度上限。
 *
 * 起圈半径是 `min(mapW,mapH) * 0.52 = 1040`,`shrinkZone` 收到 60 就不再收,
 * 也就是一共要收 980。原先 `shrink = 3 + w * 1.4` 一路长下去,第 20 波 32 秒
 * 就收到底、第 100 波只剩 7 秒 —— 那时候不是「更难」,是场上没地方待了,
 * 剩下的时间只能在圈外硬扛掉质量,等结算。封到 24 之后收圈窗口不会短过 41 秒,
 * 目标质量照旧一波一波往上加,难度还是在涨,只是涨在「要吃多少」而不是「还剩几秒」。
 *
 * 第 15 波开始才封得住(3 + 1.4×15 = 24),之前每一波的数字一个都没变。
 */
export const ENDLESS_MAX_SHRINK = 24;

/**
 * 无尽的豆子数上限。
 *
 * 豆子被吃掉会立刻在地图上随机重生,供给本来就是无限的,`pellets` 只决定
 * 同时铺在地上多少颗。而碰撞检测是每帧遍历一遍这个数组,原先
 * `140 + w * 6` 无上限,第 500 波要铺 3140 颗、第 5000 波 30140 颗 ——
 * 纯粹的帧率悬崖,一点玩法收益都没有。第 30 波开始才封得住。
 */
export const ENDLESS_MAX_PELLETS = 320;

export function endlessConfig(wave: number): OrbLevel {
  const w = Math.max(1, Math.round(wave));
  return {
    level: -1,
    mapW: 2000,
    mapH: 2000,
    // 三个「越往后越大」的旋钮都有上限,理由见下面的常量注释
    pellets: Math.min(ENDLESS_MAX_PELLETS, 140 + w * 6),
    viruses: Math.min(14, 2 + w),
    bots: Math.min(11, 2 + Math.floor(w / 2)),
    botTier: w >= 9 ? "hell" : w >= 6 ? "pro" : w >= 3 ? "normal" : "rookie",
    targetMass: 140 + w * 55,
    timeSec: 0,
    shrink: Math.min(ENDLESS_MAX_SHRINK, 3 + w * 1.4),
    ally: false,
    fog: w >= 5
  };
}

/** 三星评价:目标质量的余量越多、用时越短,星越多 */
export function starsFor(finalMass: number, target: number, usedSec: number, limitSec: number): 1 | 2 | 3 {
  if (finalMass < target) return 1;
  const spare = finalMass / Math.max(1, target);
  const timeLeft = limitSec > 0 ? 1 - usedSec / Math.max(1, limitSec) : 0.5;
  if (spare >= 1.4 && timeLeft >= 0.25) return 3;
  if (spare >= 1.12 || timeLeft >= 0.4) return 2;
  return 1;
}

/** 关卡目标写成一句话 */
export function goalLine(cfg: OrbLevel): string {
  const parts = [`长到 ${cfg.targetMass} 质量`];
  if (cfg.timeSec > 0) parts.push(`${cfg.timeSec} 秒内`);
  if (cfg.shrink > 0) parts.push("注意安全区在收");
  if (cfg.ally) parts.push("别吃掉队友最后一颗圆");
  return parts.join(" · ");
}
