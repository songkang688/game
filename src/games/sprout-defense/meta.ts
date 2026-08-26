/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "sprout-defense",
  title: "绿芽保卫战",
  emoji: "🌱",
  category: "action" as const,
  color: "#d5f2ca",
  blurb: "188 关十三大花园守家战役!十种绿芽十种虫,还能通宵守到天亮!",
  // logic.ts 前 9 章各 11 关 + 新 4 章 22/22/22/23,合计 188;
  // 1.2 起除闯关外还有无尽「守到天亮」
  modes: ["campaign", "endless"] as const,
  levels: 188,
};
