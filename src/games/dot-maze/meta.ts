/**
 * 纯数据 meta：首页 eager 收集本文件渲染卡片，玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "dot-maze",
  title: "豆豆迷宫",
  emoji: "🟡",
  category: "action" as const,
  color: "#FFF5B8",
  blurb: "在迷宫里吃光小星星。四只迷途小幽灵脾气各不相同，能量豆一亮它们就变成昏昏蓝。",
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const,
};
