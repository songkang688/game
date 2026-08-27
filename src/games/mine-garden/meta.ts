/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不许 import 任何玩法代码。
 */
export const meta = {
  id: "mine-garden",
  title: "扫雷花园",
  emoji: "🌼",
  category: "casual" as const,
  color: "#E5F8D8",
  blurb: "看数字绕开刺种。第一下一定安全，插好小旗，把整片花园都翻开。",
  // 188 关闯关 + 同图竞速对战 + 连续清盘无尽 + 朵朵星星左右分屏双人
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "both" as const
};
