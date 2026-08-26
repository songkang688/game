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
  blurb: "188 关十大砖阵！双球齐发、滑动迷阵、星门传送、图案工坊全新登场！",
  // 10 章合计 188 关,只有闯关一种玩法
  modes: ["campaign"] as const,
  levels: 188,
};
