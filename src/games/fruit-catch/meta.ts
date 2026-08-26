/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "fruit-catch",
  title: "接住小水果",
  emoji: "🧺",
  category: "casual" as const,
  color: "#FFF4D6",
  blurb: "188 关十条果道！双篮镜像、沉甸水果、半空传送带、连击星光全新开张！",
  // 10 章合计 188 关,只有闯关一种玩法
  modes: ["campaign"] as const,
  levels: 188,
};
