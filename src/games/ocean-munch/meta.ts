/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "ocean-munch",
  title: "海底大胃王",
  emoji: "🐟",
  category: "action" as const,
  color: "#bfe9ff",
  blurb: "188 关十二片海域战役!洋流、毒藻鱼、共生小鱼、深渊压力,挑战十二位海域大王!",
  // logic.ts 的 TOTAL_LEVELS = 188,只有闯关一种玩法
  modes: ["campaign"] as const,
  levels: 188,
};
