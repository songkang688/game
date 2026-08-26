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
  blurb: "188 关十大天空！连锁爆炸、护盾气球、算式云梯、镜像风向轮番登场！",
  // 10 章合计 188 关,只有闯关一种玩法
  modes: ["campaign"] as const,
  levels: 188,
};
