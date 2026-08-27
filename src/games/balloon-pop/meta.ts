/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "balloon-pop",
  title: "气球砰砰",
  emoji: "🎈",
  category: "casual" as const,
  color: "#ff8fab",
  blurb: "188 关十大天空 + 无尽气球节!同色挨在一起会连爆,礼物气球不能戳、也别让它飞走。",
  // 10 章合计 188 关,外加一场越来越热闹的无尽气球节
  modes: ["campaign", "endless"] as const,
  levels: 188,
  // 点一下就玩,手指和鼠标都顺手
  platform: "both" as const,
};
