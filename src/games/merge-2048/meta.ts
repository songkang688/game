/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "merge-2048",
  title: "星星合成",
  emoji: "🔢",
  category: "casual" as const,
  color: "#FFF3C8",
  blurb: "同样的数字撞在一起就会变成更大的星星。合成到 2048,还能继续往上叠。",
  // 188 关战役 + 同一发牌序列的对战竞速 + 马拉松无尽 + 左右两块盘的同屏双人,全程离线
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const
};
