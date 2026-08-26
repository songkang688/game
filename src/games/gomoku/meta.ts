/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "gomoku",
  title: "五子棋",
  emoji: "⚫",
  // 主玩法是自由对战(人机四档 + 朵朵 VS 星星双人),归到「对战」比「休闲」准
  category: "party" as const,
  color: "#F6E3C5",
  blurb: "自由对战加 188 道残局棋谜、9 大主题，还能挑战会算杀的棋灵象！",
  // puzzles.ts 的 PUZZLES 正好 188 个残局(自带存档);index.ts 有 pvp 双人与四档棋灵
  modes: ["campaign", "versus", "twoPlayer"] as const,
  levels: 188,
};
