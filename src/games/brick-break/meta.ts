/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "brick-break",
  title: "碰碰砖块",
  emoji: "🧱",
  category: "casual" as const,
  color: "#FFE2D9",
  blurb: "188 关十大砖阵 + 无尽砖塔!六种砖、五个限时道具,球再快也不会穿砖,板边接球也不会横着飞。",
  // 10 章合计 188 关,外加一条会一直往下压的无尽砖塔
  modes: ["campaign", "endless"] as const,
  levels: 188,
  // 手指拖板与方向键都顺手
  platform: "both" as const,
};
