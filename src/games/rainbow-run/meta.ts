/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "rainbow-run",
  title: "彩虹跑跑",
  emoji: "🌈",
  category: "action" as const,
  color: "#e5d4ff",
  blurb: "2.5D 三车道跑酷!188 关十二大世界+无尽彩虹跑,跳跃换道下滑,铲彩纸箱踩滑轨挑战大王!",
  // logic.ts 是经典 9 章 × 11 关 + 1.1 新三章 30/30/29 = 188 关;index.ts 另有无尽彩虹跑
  modes: ["campaign", "endless"] as const,
  levels: 188,
};
