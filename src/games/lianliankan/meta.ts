/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "lianliankan",
  title: "连连看",
  emoji: "🔗",
  category: "casual" as const,
  color: "#FFEBDD",
  blurb: "188 关十大场馆 + 无尽连到底!消除会画出真实折线,四种收拢边滑边靠拢,每关还有 3 次真求解提示。",
  // 10 章合计 188 关,外加清空就自动补新盘的无尽「连到底」
  modes: ["campaign", "endless"] as const,
  levels: 188,
  // 全程点按,手指和鼠标一样顺手
  platform: "both" as const,
};
