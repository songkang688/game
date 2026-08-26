/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不 import 任何玩法代码,改动请同步 index.ts 里的实际内容。
 */
export const meta = {
  id: "fishing-star",
  title: "钓鱼小达人",
  emoji: "🎣",
  category: "casual" as const,
  color: "#e2f2fb",
  blurb: "抛竿蓄力选水层,咬钩以后比手感拉线!188 关八大水域,还有限时无尽和 25 种原创鱼的图鉴。",
  // levels.ts 的 CHAPTERS 八章合计 188 关;index.ts 另有无尽模式与图鉴页
  modes: ["campaign", "endless"] as const,
  levels: 188,
};
