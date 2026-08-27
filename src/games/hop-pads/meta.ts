/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "hop-pads",
  title: "跳跳台",
  emoji: "⭕",
  category: "casual" as const,
  color: "#FFE0C8",
  blurb: "按住蓄力，松手跳到下一座台。踩中圆心连击一直涨，掉下去也会温柔地把你接住。",
  // index.ts 四种入口:188 关闯关 / 幽灵对战 / 无尽跳 / 双人上下分屏
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  // 手机按住整块屏幕就能蓄力,电脑上空格 / F / L 一样顺手
  platform: "both" as const,
};
