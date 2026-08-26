/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "garden-guard",
  title: "花园守卫",
  emoji: "🌼",
  category: "action" as const,
  color: "#ffd6e7",
  blurb: "188 关十三大主题塔防战役!五种塔、冰晶塔和毒雾塔,越守越上头!",
  // logic.ts 的 TOTAL_LEVELS = 188,只有闯关
  modes: ["campaign"] as const,
  levels: 188,
};
