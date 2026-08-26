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
  blurb: "188 关 9 大世界!拉开大弹弓,穿过传送门、敲碎岩壳块,把捣蛋的绿绿豆全都弹走;还有越叠越高的无尽打靶塔。",
  // levels.ts 的 CHAPTER_SIZES 合计 188 关(自带存档);1.2 补了无尽「打靶塔」,
  // 每座塔固定 5 只小鸟,塔越高分越多,成绩走 save.recordEndlessBest("sling-birds")。
  // 对战没做:同屏轮流打靶要么两人干等、要么各打各的,不如把弹道深度做透(见 depth12.ts 顶注)。
  // platform 字段等窗口 1 的平台模块合进来再补,这里不自造一套。
  modes: ["campaign", "endless"] as const,
  levels: 188
};
