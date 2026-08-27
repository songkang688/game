/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "clock-house",
  title: "时钟小屋",
  emoji: "🕒",
  category: "edu" as const,
  color: "#ffa94d",
  blurb:
    "十层小屋 188 关!读钟面、拨指针、算经过时间、12 与 24 小时互换、时分秒换算,还要看懂作息表和班次表。",
  // 10 章合计 188 关;学习类只做闯关,不做对战与无尽——时间计算要的是想清楚再答,不是抢答
  modes: ["campaign"] as const,
  levels: 188,
  // 钟面能用手指拖着拨,也能用方向键拨,手机和电脑都顺手
  platform: "both" as const,
};
