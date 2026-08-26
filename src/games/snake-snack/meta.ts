/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "snake-snack",
  title: "贪吃毛毛虫",
  emoji: "🐛",
  category: "casual" as const,
  color: "#E2F7DC",
  blurb: "99 关六大花园！树篱石柱回字迷宫，追上星星果多拿星！",
  // levels.ts 的 6 章合计 99 关(还没扩到 188),只有闯关
  modes: ["campaign"] as const,
  levels: 99,
};
