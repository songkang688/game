/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "sudoku-petal",
  title: "数独花田",
  emoji: "9️⃣",
  category: "edu" as const,
  color: "#E8DDFF",
  blurb: "每一行、每一列、每一朵九宫花都要种满 1 到 9。提示只讲方法，不把答案告诉你。",
  // 188 关战役 + 同题竞速的对战 + 错三题结束的无尽 + 左右分盘的同屏双人,全程离线
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  ageHint: 9,
  platform: "mobile" as const
};
