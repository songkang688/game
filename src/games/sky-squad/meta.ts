/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "sky-squad",
  title: "飞机小队",
  emoji: "✈️",
  category: "action" as const,
  color: "#dbeaff",
  blurb: "188 关八片天空!三种主武器加僚机护盾炸弹,每章一位多段弹幕大 Boss。",
  // index.ts 模式条:188 关战役 / 无尽波次 / 双人合作同屏两机
  modes: ["campaign", "endless", "coop", "twoPlayer"] as const,
  levels: 188,
};
