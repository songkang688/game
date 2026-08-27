/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "gomoku",
  title: "五子棋",
  emoji: "⚫",
  // 主玩法是自由对战(人机六档 + 朵朵 VS 星星双人),归到「对战」比「休闲」准
  category: "party" as const,
  color: "#F6E3C5",
  blurb: "188 道真解局，人机六档从菜鸟打到地狱，还有连胜挑战！",
  // puzzles.ts 的 PUZZLES 正好 188 个残局(走 188 关框架);index.ts 有双人同屏、
  // 六档棋灵与连胜挑战(连胜写平台 endlessBest,所以也算 endless)
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  // 手机点棋盘、桌面点鼠标都好用:落子确认默认手机开、桌面关
  platform: "both" as const,
};
