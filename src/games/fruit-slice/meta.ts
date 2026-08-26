/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "fruit-slice",
  title: "水果切切乐",
  emoji: "🍑",
  category: "action" as const,
  color: "#ffe0a3",
  blurb: "188 回合十二果园切果战役!连刀、指令果、硬壳果、镜像模式,最后挑战大果王!",
  // logic.ts 的 TOTAL_ROUNDS = 188;index.ts 另有禅宗模式与街机无尽(都算无尽玩法)
  modes: ["campaign", "endless"] as const,
  levels: 188,
};
