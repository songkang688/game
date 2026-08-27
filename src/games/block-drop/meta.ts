/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "block-drop",
  title: "方块叠叠乐",
  emoji: "🧱",
  category: "casual" as const,
  color: "#D9E8FF",
  blurb: "七种小方块轮流落下。转一转、挪一挪,凑满一整行就会开花消掉。",
  // 188 关战役 + 对战发垃圾行 + 马拉松无尽 + 同屏双人,对手是本机 AI,全程离线
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const
};
