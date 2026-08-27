/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不 import 任何玩法代码,改动请同步 index.ts 里的实际内容。
 */
export const meta = {
  id: "pool-stars",
  title: "梨康台球",
  emoji: "🎱",
  category: "casual" as const,
  color: "#CDE8D0",
  blurb: "先把自己那一组颜色打完,再把黑星球送进袋。母球掉下去就要把杆交给对方。",
  // levels.ts 的 CHAPTERS 八章合计 188 关;index.ts 另有人机对战 BO3、无尽残局与双人同屏
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const,
};
