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
  blurb: "188 关十二大世界跑酷+无尽彩虹跑!铲彩纸箱、踩加速滑轨、三连完美跳挑战大王!",
  // logic.ts 是经典 9 章 × 11 关 + 1.1 新三章 30/30/29 = 188 关;index.ts 另有无尽彩虹跑
  modes: ["campaign", "endless"] as const,
  levels: 188,
};
