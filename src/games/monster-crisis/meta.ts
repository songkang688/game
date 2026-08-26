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
  blurb: "188 关动作守家!自己上场跑位甩颜料弹,每 3 波挑一张成长卡,把小怪物涂成小云朵。",
  // levels.ts 是 8 个章节共 188 关;index.ts 另有无尽、双人合作、各守一半的对战。
  // 四种模式都真能打到结算(`arena.test.ts` 里各跑一次),所以四种都留着。
  modes: ["campaign", "endless", "coop", "versus"] as const,
  levels: 188,
};
