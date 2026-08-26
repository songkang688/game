/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不 import 任何玩法代码,改动请同步 index.ts 里的实际内容。
 */
export const meta = {
  id: "bomb-buddies",
  title: "泡泡炸弹人",
  emoji: "🫧",
  category: "action" as const,
  color: "#e6f0ff",
  blurb: "格子迷宫里摆泡泡弹!188 关八大主题清怪找出口,还能双人对战、人机对战、无尽收缩和双人合作。",
  // levels.ts 的 CHAPTERS 八章合计 188 关;index.ts 的模式条另有对战 / 人机 / 无尽 / 合作
  modes: ["campaign", "versus", "endless", "coop", "twoPlayer"] as const,
  levels: 188,
};
