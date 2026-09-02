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
  blurb: "披上披风当爱干净的小超人!188 关跑跳清扫,街道、公园、星空屋顶三套街景轮着换,把豆豆怪变成小花、把垃圾投进三色桶,还有打扫不完的城市和双人分工合作。",
  // 8 章合计 188 关;index.ts 的模式条有「打扫不完的城市」(无尽)与双人合作
  modes: ["campaign", "endless", "coop"] as const,
  levels: 188,
};
