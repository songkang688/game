/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不 import 任何玩法代码,改动请同步 index.ts 里的实际内容。
 */
export const meta = {
  id: "chess-garden",
  title: "花园国际象棋",
  emoji: "♔",
  category: "party" as const,
  color: "#F0E6D8",
  blurb: "王、后、车、象、马、兵，各有各的走法。记得易位、吃过路兵和升变，把对方的王请进包围圈。",
  // levels.ts 的 CHAPTERS 八章合计 188 关;index.ts 另有人机四档、无尽连胜与双人同屏
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const,
};
