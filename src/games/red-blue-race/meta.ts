/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "red-blue-race",
  title: "红蓝赛跑",
  emoji: "🏁",
  category: "party" as const,
  color: "#51cf66",
  blurb:
    "左右交替按才跑得快,砸同一个键会越按越吃力!188 关十大赛道,对战场能两个人比或挑四档小电脑,还有撞三次才收工的无尽跑道。",
  // 10 章合计 188 关;index.ts 另有「对战场」(本地两人 / 四档小电脑)与「跑不完的跑道」无尽模式
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  // 触屏左右半屏两颗大按钮、键盘两套键位,手机和电脑都顺手
  platform: "both" as const,
};
