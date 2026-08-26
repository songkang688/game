/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不 import 任何玩法代码,改动请同步 index.ts 里的实际内容。
 */
export const meta = {
  id: "poop-hero",
  title: "便便超人",
  emoji: "🦸",
  category: "action" as const,
  color: "#F3E0CE",
  blurb: "披上披风当噗噗超人!188 关跳跳冲冲把臭臭怪变成小花,还有清洁马拉松和双人合作。",
  // 8 章合计 188 关;index.ts 的模式条有清洁马拉松(无尽)与双人合作
  modes: ["campaign", "endless", "coop"] as const,
  levels: 188,
};
