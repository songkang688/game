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
  blurb: "朵朵星星同屏开跑！三条车道躲石头跳木栏，吃金币踩加速带，看谁跑得远！",
  // index.ts 两个赛制:无尽对战比谁远 + 抢金币赛,都是双人同屏,没有闯关地图
  modes: ["versus", "endless", "twoPlayer"] as const,
};
