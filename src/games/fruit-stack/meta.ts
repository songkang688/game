/**
 * 纯数据 meta：首页 eager 收集本文件渲染卡片，玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "fruit-stack",
  title: "果果合成",
  emoji: "🍉",
  category: "casual" as const,
  color: "#FFD9D0",
  blurb: "一样的果子碰在一起就会变大。慢慢堆，别让它们越过警戒线。",
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const,
};
