/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "snake-royale",
  title: "长蛇争霸",
  emoji: "🐍",
  category: "action" as const,
  color: "#D8F5D0",
  blurb: "在开阔的糖果原野上越长越长。加速要掉长度,围住别人才是真本事。",
  // 188 关战役 + 本地混战 + 缩圈无尽 + 同屏双人,对手全是本机 AI,全程离线
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const
};
