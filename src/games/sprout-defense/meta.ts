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
  blurb: "99 关九大花园守家战役!七种植物九种虫,决战虫虫女王!",
  // logic.ts 是 9 个花园 × LEVELS_PER_THEME 11 = 99 关,只有闯关
  modes: ["campaign"] as const,
  levels: 99,
};
