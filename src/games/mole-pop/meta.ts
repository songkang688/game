/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "mole-pop",
  title: "地鼠嘭嘭",
  emoji: "🐹",
  category: "casual" as const,
  color: "#EBDFC8",
  blurb: "188 关十大地洞！算式鼠、连击槽、铁盔鼠、月夜手电筒，还有无尽地鼠场！",
  // levels.ts 的 10 章合计 188 关,外加无尽地鼠场
  modes: ["campaign", "endless"] as const,
  levels: 188,
};
