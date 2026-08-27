/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不许 import 任何玩法代码。
 */
export const meta = {
  id: "weiqi-garden",
  title: "围子花园",
  emoji: "⚫",
  category: "party" as const,
  color: "#E8E4D8",
  blurb: "先从九路花园下起。围空、打劫、数目或点目,慢慢走进十三路和十九路。",
  // 188 关死活 / 官子 / 布局 + 四档人机自由对战 + 九路连胜无尽 + 鸭梨康康同屏双人
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const
};
