/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "find-diff",
  title: "找不同",
  emoji: "🔍",
  category: "edu" as const,
  color: "#63e6be",
  blurb: "十大主题 188 关!两图对照找不同,后段还有三图对照、旋转、镜像与连环挑战;另有找不同马拉松无尽模式。",
  // 10 章合计 188 关(前 6 章 99 关是 1.0 原样保留),闯关 + 无尽两种模式
  modes: ["campaign", "endless"] as const,
  levels: 188,
};
