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
  blurb: "岸上蓄力抛竿,水下咬钩收竿:张力进红区还有 1.2 秒能救回来。188 关八大水域,「钓到天黑」无尽赛总重量,25 种原创鱼图鉴记你最大的一条。",
  // levels.ts 的 CHAPTERS 八章合计 188 关;index.ts 另有「钓到天黑」无尽、图鉴与星星装备页
  modes: ["campaign", "endless"] as const,
  levels: 188,
};
