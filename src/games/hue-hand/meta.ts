/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "hue-hand",
  title: "花色接龙",
  emoji: "🌈",
  category: "party" as const,
  color: "#FFD4E8",
  blurb: "颜色或数字对上就能出。跳过、加二、换个颜色,剩最后一张记得喊「就一张」。",
  // index.ts 四种入口:188 关闯关 / 对战 2–4 人 / 无尽连胜积分赛 / 双人同屏
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  // 手机点选就能玩,电脑上还有整套键位,所以两个平台都上
  platform: "both" as const,
};
