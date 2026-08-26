/**
 * 红蓝点点 · 188 关关卡表。
 *
 * 1.0 的前 99 关（六个主题赛场、不同的抢点规则）一字未改：
 *  ①点点广场=见点就抢  ②颜色为号=只抢蓝点红点是陷阱  ③星星石头=抢⭐别碰🌑
 *  ④闪电快拍=点点闪现更快  ⑤双子挑战=一次冒两个  ⑥大师殿堂=全规则混合
 *
 * 1.1 在末尾追加 89 关、4 个全新章节，各带一种前 99 关没有的对抗机制：
 *  ⑦霓虹连击场=连击加成  ⑧机关道具局=道具点（冻结 / 磁铁）
 *  ⑨序列谜阵=按号码顺序抢  ⑩读心决赛=读招电脑
 *
 * 和小电脑抢点，先到目标分获胜。
 */
import type { Chapter } from "../level99";

export interface TapLevel {
  /** 先抢到几分获胜 */
  targetPoints: number;
  /** 小电脑出手时间（毫秒，越短越难） */
  aiDelayMs: number;
  /** 陷阱点概率（点了给小电脑加分） */
  trapChance: number;
  /** 一次出现两个点 */
  double: boolean;
  theme: number;
  /** 1.1 新增 · 连续抢到几个不失手就进入连击；0 / 省略表示这一关没有连击 */
  comboNeed?: number;
  /** 1.1 新增 · 连击状态下每个点算几分 */
  comboScore?: number;
  /** 1.1 新增 · 道具点出现概率（❄️ 冻住对手、🧲 自动吸走下一个点） */
  powerChance?: number;
  /** 1.1 新增 · 序列点的链长（要按 1→2→3 的号码顺序拍）；0 / 省略表示不启用 */
  sequence?: number;
  /** 1.1 新增 · 读招强度 0..1：你领先越多，小电脑出手越快 */
  aiAdapt?: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "点点广场", emoji: "🎈", color: "#D6EBFF", desc: "点点一冒出来就抢先拍下去！", size: 17 },
  { name: "颜色为号", emoji: "🎨", color: "#FFE0EC", desc: "只拍蓝色点点，红色是小电脑的陷阱！", size: 17 },
  { name: "星星石头", emoji: "⭐", color: "#FFF3C4", desc: "抢亮亮的星星，黑石头千万别碰！", size: 17 },
  { name: "闪电快拍", emoji: "⚡", color: "#FFE9D6", desc: "小电脑出手飞快，拼的就是反应！", size: 16 },
  { name: "双子挑战", emoji: "✌️", color: "#E2F7DF", desc: "一次冒出两个点，两个都要抢！", size: 16 },
  { name: "大师殿堂", emoji: "👑", color: "#EBDFFB", desc: "所有规则轮着来，抢点大师之战！", size: 16 },
  // ---- 1.1 追加的 89 关：四个全新章节，各带一种前 99 关没有的对抗机制 ----
  { name: "霓虹连击场", emoji: "💫", color: "#FFE6F5", desc: "连抢三个不失手就进连击，之后每个点算双倍分！", size: 23 },
  { name: "机关道具局", emoji: "🧲", color: "#E4F6EE", desc: "❄️ 冻住对手、🧲 自动吸点，道具要抢在它前面！", size: 22 },
  { name: "序列谜阵", emoji: "🔢", color: "#FFF0DC", desc: "点点带上号码，必须按 1→2→3 的顺序拍下去！", size: 22 },
  { name: "读心决赛", emoji: "🧠", color: "#E5E2F8", desc: "你一领先它就出手更快，所有规则一起上！", size: 22 }
];

function buildLevel(ci: number, t: number): TapLevel {
  switch (ci) {
    case 0:
      return { targetPoints: 5 + Math.floor(t / 4), aiDelayMs: 1400 - t * 30, trapChance: 0, double: false, theme: 0 };
    case 1:
      return { targetPoints: 6 + Math.floor(t / 4), aiDelayMs: 1350 - t * 25, trapChance: 0.3, double: false, theme: 1 };
    case 2:
      return { targetPoints: 6 + Math.floor(t / 4), aiDelayMs: 1250 - t * 25, trapChance: 0.35, double: false, theme: 2 };
    case 3:
      return { targetPoints: 7 + Math.floor(t / 4), aiDelayMs: 1000 - t * 22, trapChance: 0.1, double: false, theme: 3 };
    case 4:
      return { targetPoints: 8 + Math.floor(t / 4), aiDelayMs: 1250 - t * 20, trapChance: 0.1, double: true, theme: 4 };
    // ---- 1.1 新章：小学六年级向，光有手速不够，还要接连击、抢道具、按顺序推理 ----
    case 6:
      // 霓虹连击场：目标分翻倍，但接得上连击就能双倍追分
      return {
        targetPoints: 12 + Math.floor(t / 4),
        aiDelayMs: 640 - t * 4,
        trapChance: 0.2,
        double: false,
        theme: 6,
        comboNeed: 3,
        comboScore: 2
      };
    case 7:
      // 机关道具局：❄️ 冻住对手、🧲 自动吸点，道具用得好才追得上
      return {
        targetPoints: 12 + Math.floor(t / 4),
        aiDelayMs: 620 - t * 3,
        trapChance: 0.25,
        double: t % 3 === 2,
        theme: 7,
        powerChance: 0.28 + t * 0.004
      };
    case 8:
      // 序列谜阵：号码要按顺序拍，链越长越考验记性与手上的规划
      return {
        targetPoints: 15 + Math.floor(t / 2),
        aiDelayMs: 620 - t * 4,
        trapChance: 0,
        double: false,
        theme: 8,
        sequence: 2 + Math.floor(t / 11),
        comboNeed: 4,
        comboScore: 2
      };
    case 9:
      // 读心决赛：读招电脑 + 前面所有规则轮番上阵
      return {
        targetPoints: 12 + Math.floor(t / 3),
        aiDelayMs: 780 - t * 5,
        trapChance: 0.2,
        double: t % 2 === 1,
        theme: 9,
        aiAdapt: 0.12 + t * 0.008,
        powerChance: 0.2,
        sequence: t % 3 === 2 ? 2 : 0,
        comboNeed: 4,
        comboScore: 2
      };
    default:
      return { targetPoints: 8 + Math.floor(t / 3), aiDelayMs: 950 - t * 18, trapChance: 0.25, double: t % 2 === 1, theme: 5 };
  }
}

export const LEVELS: TapLevel[] = (() => {
  const out: TapLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();
