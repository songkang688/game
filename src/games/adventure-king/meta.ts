/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "adventure-king",
  title: "冒险小王",
  emoji: "🗺️",
  category: "action" as const,
  color: "#ffe0b2",
  blurb: "188 关八大遗迹!甩回旋镖、荡抓钩,集齐三件神器推开首领之门,还有无尽遗迹和计时速通!",
  // 8 章合计 188 关(levels.ts 的 CHAPTERS),index.ts 另有无尽遗迹与计时速通
  modes: ["campaign", "endless"] as const,
  levels: 188,
};
