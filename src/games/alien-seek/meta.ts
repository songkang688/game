/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "alien-seek",
  title: "寻找外星朋友",
  emoji: "🛸",
  category: "casual" as const,
  color: "#e3e0ff",
  blurb: "188 关手绘小场景!限时找出躲起来的外星小朋友,后面还要靠线索推理,另有无尽模式和双人抢答。",
  // 8 章合计 188 关;index.ts 的模式条有无尽寻找与双人对战(两个光标同屏抢)
  modes: ["campaign", "endless", "versus", "twoPlayer"] as const,
  levels: 188,
};
