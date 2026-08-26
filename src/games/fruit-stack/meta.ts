/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不 import 任何玩法代码,改动请同步 index.ts 里的实际内容。
 */
export const meta = {
  id: "fruit-stack",
  title: "果果合成",
  emoji: "🍉",
  category: "casual" as const,
  color: "#FFD9D0",
  blurb: "一样的果子碰在一起就会变大。慢慢堆,别让它们越过警戒线。",
  // levels.ts 的 CHAPTERS 八章合计 188 关;index.ts 另有对战 / 双人同屏 / 无尽
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  // 键盘和触屏两套操作都做全了,手游端游都能玩
  platform: "both" as const,
};
