/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "duo-rush",
  title: "朵星双人冲刺",
  emoji: "🏃",
  category: "party" as const,
  color: "#CDE9FF",
  blurb: "2.5D 分屏竞速!朵朵星星各控三车道,无尽、抢金币、幽灵配速和人机三档都能跑。",
  // index.ts:2.5D 分屏无尽竞速 / 抢金币 / 幽灵对战 / 人机三档,没有闯关地图
  modes: ["versus", "endless", "twoPlayer"] as const,
};
