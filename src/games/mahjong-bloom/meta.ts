/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "mahjong-bloom",
  title: "花开麻将",
  emoji: "🀄",
  category: "party" as const,
  color: "#FFE8F0",
  blurb: "吃碰杠胡,把番数凑够八番。和朵朵星星还有两位棋友坐一桌,看谁先开花。",
  // 国标规则的四人麻将:188 关残局战役 + 一人三机对战 + 快棋无尽 + 同屏双人,全程离线
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const
};
