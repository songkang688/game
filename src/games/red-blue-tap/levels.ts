/**
 * 红蓝点点 · 99 关关卡表。
 * 六个主题赛场、不同的抢点规则（并非同一模板）：
 *  ①点点广场=见点就抢  ②颜色为号=只抢蓝点红点是陷阱  ③星星石头=抢⭐别碰🌑
 *  ④闪电快拍=点点闪现更快  ⑤双子挑战=一次冒两个  ⑥大师殿堂=全规则混合
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
}

export const CHAPTERS: Chapter[] = [
  { name: "点点广场", emoji: "🎈", color: "#D6EBFF", desc: "点点一冒出来就抢先拍下去！", size: 17 },
  { name: "颜色为号", emoji: "🎨", color: "#FFE0EC", desc: "只拍蓝色点点，红色是小电脑的陷阱！", size: 17 },
  { name: "星星石头", emoji: "⭐", color: "#FFF3C4", desc: "抢亮亮的星星，黑石头千万别碰！", size: 17 },
  { name: "闪电快拍", emoji: "⚡", color: "#FFE9D6", desc: "小电脑出手飞快，拼的就是反应！", size: 16 },
  { name: "双子挑战", emoji: "✌️", color: "#E2F7DF", desc: "一次冒出两个点，两个都要抢！", size: 16 },
  { name: "大师殿堂", emoji: "👑", color: "#EBDFFB", desc: "所有规则轮着来，抢点大师之战！", size: 16 }
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
