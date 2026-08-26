/**
 * 纯数据 meta：首页 eager 收集本文件渲染卡片，玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "duo-vs-star",
  title: "朵朵大战星星",
  emoji: "💥",
  category: "party" as const,
  color: "#ffd0e4",
  blurb: "十二位好朋友的弹飞大混战！把对手的击退值撞满，再一记重击送出场外——双人、混战、2v2、无尽和 188 关全都有。",
  // index.ts 五种入口:双人对战 / 人机混战 / 2v2 / 无尽车轮战 / 188 关闯关
  modes: ["campaign", "versus", "endless", "coop", "twoPlayer"] as const,
  levels: 188,
};
