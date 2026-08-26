/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "math-farm",
  title: "算数小农场",
  emoji: "🐮",
  category: "edu" as const,
  color: "#8ce99a",
  blurb: "六大农场 99 关！数一数、加减法、凑十破十、连加连减，喂饱全部小动物！",
  // 10 章合计 188 关(blurb 里的「99」是 1.0 遗留文案,归 B 改),只有闯关
  modes: ["campaign"] as const,
  levels: 188,
};
