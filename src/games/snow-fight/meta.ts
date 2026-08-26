/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "snow-fight",
  title: "雪球大作战",
  emoji: "⛄",
  category: "party" as const,
  color: "#e3f0fd",
  blurb: "冬天的抛物线对决:蓄力、看风向、算落点,掩体能砸碎也能自己堆雪墙。188 关闯关,外加双人对战、三档人机和雪怪车轮战。",
  // 8 章合计 188 关;index.ts 的模式条有双人对战、人机对战(三档)与无尽雪怪
  modes: ["campaign", "versus", "twoPlayer", "endless"] as const,
  levels: 188,
};
