/**
 * 气球砰砰 · 99 关关卡表。
 * 六个主题章节、四种玩法模式（并非同一模板）：
 *  ①彩色广场=自由砰砰  ②颜色指令=只戳指定颜色  ③数字气球=按 1→5 顺序戳
 *  ④乌云闯入=乌云球不能戳  ⑤闪电风暴=飞得快+彩虹清屏  ⑥烟花之夜=全机关混合
 */
import type { Chapter } from "../level99";

export type BalloonMode = "free" | "color" | "number";

export interface BalloonLevel {
  /** 需要戳破的气球数 */
  target: number;
  /** 最多允许飘走几个该戳的气球 */
  escapes: number;
  /** 上升速度（像素/秒） */
  riseSpeed: number;
  spawnMs: number;
  mode: BalloonMode;
  /** 乌云球概率（不能戳） */
  cloudChance: number;
  /** 彩虹球概率（戳了清屏） */
  rainbowChance: number;
  /** 夜晚主题 */
  night: boolean;
}

export const CHAPTERS: Chapter[] = [
  { name: "彩色广场", emoji: "🎈", color: "#FFE0EC", desc: "气球飘上来就戳破它！", size: 17 },
  { name: "颜色指令", emoji: "🎯", color: "#FFF0C9", desc: "只能戳指定颜色的气球哦！", size: 17 },
  { name: "数字气球", emoji: "🔢", color: "#D6EBFF", desc: "按 1→2→3→4→5 的顺序戳！", size: 17 },
  { name: "乌云闯入", emoji: "☁️", color: "#E8E6F0", desc: "乌云球会捣乱，千万别戳它！", size: 16 },
  { name: "闪电风暴", emoji: "⚡", color: "#FFF6D8", desc: "气球飞得飞快，彩虹球能清屏！", size: 16 },
  { name: "烟花之夜", emoji: "🎆", color: "#DCD6F5", desc: "夜空下颜色指令+乌云一起来！", size: 16 }
];

function buildLevel(ci: number, t: number): BalloonLevel {
  switch (ci) {
    case 0:
      return {
        target: 10 + t, escapes: 4,
        riseSpeed: 55 + t * 3, spawnMs: 950 - t * 15,
        mode: "free", cloudChance: 0, rainbowChance: 0, night: false
      };
    case 1:
      return {
        target: 10 + Math.floor(t / 2), escapes: 5,
        riseSpeed: 55 + t * 3, spawnMs: 900 - t * 12,
        mode: "color", cloudChance: 0, rainbowChance: 0, night: false
      };
    case 2:
      return {
        target: 10 + Math.floor(t / 2), escapes: 6,
        riseSpeed: 50 + t * 3, spawnMs: 900 - t * 10,
        mode: "number", cloudChance: 0, rainbowChance: 0, night: false
      };
    case 3:
      return {
        target: 12 + t, escapes: 4,
        riseSpeed: 62 + t * 3, spawnMs: 820 - t * 10,
        mode: "free", cloudChance: 0.2 + t * 0.008, rainbowChance: 0, night: false
      };
    case 4:
      return {
        target: 15 + t, escapes: 5,
        riseSpeed: 85 + t * 4, spawnMs: 700 - t * 10,
        mode: "free", cloudChance: 0.1, rainbowChance: 0.08, night: false
      };
    default:
      return {
        target: 12 + Math.floor(t / 2), escapes: 5,
        riseSpeed: 70 + t * 4, spawnMs: 760 - t * 10,
        mode: t % 2 === 0 ? "color" : "number", cloudChance: 0.14, rainbowChance: 0.05, night: true
      };
  }
}

export const LEVELS: BalloonLevel[] = (() => {
  const out: BalloonLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();

/**
 * 进关目标朗读（识字量有限的孩子靠听懂玩法与机关）。
 * 与画面小字提示同逻辑，纯函数便于测试。
 */
export function goalSpeechLine(cfg: BalloonLevel): string {
  const base =
    cfg.mode === "color"
      ? `戳破 ${cfg.target} 个气球！看清指令说的颜色再戳！`
      : cfg.mode === "number"
        ? `按 1 到 5 的顺序戳气球，戳满 ${cfg.target} 个！`
        : `气球飘上来就戳破它，戳满 ${cfg.target} 个！`;
  const parts = [base];
  if (cfg.cloudChance > 0) parts.push("乌云球不能戳！");
  if (cfg.night) parts.push("天黑啦，看仔细再出手！");
  return parts.join("");
}
