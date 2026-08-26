/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不许 import 任何玩法代码,改动请与 index.ts / levels.ts 保持一致。
 */
export const meta = {
  id: "monster-crisis",
  title: "小怪物危机",
  emoji: "👾",
  category: "action" as const,
  color: "#e6dcff",
  blurb: "188 关守家大作战!摆路障、架炮台、亲手甩颜料弹,把小怪物变成小花花。",
  // levels.ts 是 8 个章节共 188 关;index.ts 另有无尽、双人合作、非对称对战
  modes: ["campaign", "endless", "coop", "versus"] as const,
  levels: 188,
};
