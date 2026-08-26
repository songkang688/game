/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "orb-arena",
  title: "圆圆大作战",
  emoji: "🟣",
  category: "action" as const,
  color: "#E4D9FF",
  blurb: "在圆圆竞技场里长大、分身、绕开刺球！挤进排行榜前十才算真高手。",
  // 188 关战役 + 本地混战 + 缩圈无尽 + 同屏双人,其他「玩家」全是本地 AI,不联网
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const
};
