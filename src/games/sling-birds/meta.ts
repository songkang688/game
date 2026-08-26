/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "sling-birds",
  title: "弹弹小鸟",
  emoji: "🐦",
  category: "action" as const,
  color: "#CFEBFF",
  blurb: "188 关 9 大世界!拉开大弹弓,穿过传送门、敲碎岩壳块,把捣蛋的绿绿豆全都弹走!",
  // levels.ts 的 CHAPTER_SIZES 合计 188 关(自带存档),只有闯关
  modes: ["campaign"] as const,
  levels: 188
};
