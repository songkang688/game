/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "landlord-cards",
  title: "朵朵抢地主",
  emoji: "🃏",
  category: "party" as const,
  color: "#ffe0ef",
  blurb: "54 张牌、三个人、叫分抢地主!单张对子顺子飞机全都有,还有 188 层地主塔和无尽连胜。",
  // index.ts 三种入口:双人对战(朵朵+星星+小牌灵) / 188 层地主塔 / 无尽连胜
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
};
