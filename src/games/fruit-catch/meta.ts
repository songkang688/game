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
  blurb: "188 关十条果道 + 双人抢果 + 无尽水果雨!冰冻果定住全场、磁铁果放大篮口,每一颗都保证跑得到。",
  // 10 章合计 188 关,外加左右半屏的双人抢果与越下越密的无尽水果雨
  modes: ["campaign", "twoPlayer", "endless"] as const,
  levels: 188,
  // 四个大按钮 + 半屏拖动,键盘 A/D 与方向键也顺手
  platform: "both" as const,
};
