/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "brave-path",
  title: "勇者小路",
  emoji: "🗡️",
  category: "action" as const,
  color: "#e9e2ff",
  blurb: "188 关轻 RPG 冒险!五系克制、打前先给「打得过 / 有点悬」的预判,无尽之路每 5 层歇脚补给,还能和康康的影子同图竞速。",
  // levels.ts 的 TOTAL_LEVELS = 188;index.ts 三个模式入口:闯关 / 无尽之路 / 对战康康的队伍(含同图竞速)
  modes: ["campaign", "endless", "versus"] as const,
  levels: 188,
  // 1.2 平台字段:战斗全是按钮、迷宫有方向键也有 ≥44px 的触屏方向盘,手机和电脑都完整可玩
  platform: "both" as const,
};
