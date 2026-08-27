/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "star-estate",
  title: "朵星地产",
  emoji: "🏦",
  category: "party" as const,
  color: "#FFF0D6",
  blurb: "掷骰子绕棋盘,买下一条街再盖小屋。收过路费,看谁最后还捧得住钱包。",
  // 188 关残局战役 + 1 人对 3 个本机 AI + 短盘连胜无尽 + 朵朵星星同屏轮流,全程离线
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const
};
