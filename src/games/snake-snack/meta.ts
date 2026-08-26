/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "snake-snack",
  title: "贪吃毛毛虫",
  emoji: "🐛",
  category: "casual" as const,
  color: "#E2F7DC",
  blurb: "格子迷宫里的 188 关十座花园:双身位、传送星门、巡逻小刺猬、推得动的小石头和绕圈开的小门;无尽花园还分越吃越快和不加速两档。",
  // levels.ts 的 10 章合计 188 关,外加无尽花园(经典 / 休闲两档)
  modes: ["campaign", "endless"] as const,
  // 画面上划一下就转弯,底下还有 44px 的四方向键;键盘方向键与 WASD 同样好使
  platform: "both" as const,
  levels: 188,
};
