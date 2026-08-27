/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "landlord-cards",
  title: "鸭梨抢地主",
  emoji: "🃏",
  category: "party" as const,
  color: "#ffe0ef",
  blurb:
    "54 张牌、三个人、叫分抢地主!牌型全套,牌力提示分三档随时切换,还有 188 层地主塔、无尽连胜和本地两人同屏。",
  // index.ts 的入口:188 层地主塔 / 双人对战(鸭梨+康康+小牌灵)/ 无尽连胜;双人对战同时也是本地两人玩法
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
};
