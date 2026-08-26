/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不 import 任何玩法代码,改动请同步 index.ts 里的实际内容。
 */
export const meta = {
  id: "bumper-cars",
  title: "碰碰车大乱斗",
  emoji: "🚗",
  category: "party" as const,
  color: "#ffe6ef",
  blurb: "俯视撞人擂台!把对手顶下场地就得分,188 关八大主题闯关,还能双人同屏、人机三档和无尽车海。",
  // levels.ts 的 CHAPTERS 八章合计 188 关;index.ts 的模式条另有对战 / 人机 / 无尽
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
};
