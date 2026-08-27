/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "flight-chess",
  title: "飞行棋乐园",
  emoji: "✈️",
  category: "party" as const,
  color: "#D6F0FF",
  blurb: "四个人掷骰子绕圈飞。叠在一起最安全，跳格飞线最开心，先到齐的人获胜。",
  // 188 关残局战役 + 1 人对 3 个本机 AI + 连胜无尽 + 朵朵星星同屏两色,全程离线
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const
};
