/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "match-stars",
  title: "星星消消乐",
  emoji: "⭐",
  category: "casual" as const,
  color: "#FFE3F1",
  blurb: "188 关十一大主题，消掉一片就看着星星一格一格落下来；还能和小伙伴比赛清订单，或者一路无尽消下去。",
  // index.ts 四个入口:188 关闯关 / 人机对战清订单 / 无尽订单 / 双人同屏
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  // 触屏点两格最顺,鼠标和 WASD / 方向键也照样玩
  platform: "both" as const,
};
