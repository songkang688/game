/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "word-garden",
  title: "识字小花园",
  emoji: "🌸",
  category: "edu" as const,
  color: "#faa2c1",
  blurb:
    "十一座花园 188 关!看图认字、拼音选字、形近字辨析、成语补全、近反义词、偏旁推字义,还能在田字格里按笔顺描红、分辨多音字!",
  // 11 章合计 188 关;学习类只做闯关,不做对战与无尽——认字要的是看清楚想明白,不是抢答
  modes: ["campaign"] as const,
  levels: 188,
  // 描红台同时吃手指与鼠标,选项按钮 ≥44px,手机和电脑都顺手
  platform: "both" as const,
};
