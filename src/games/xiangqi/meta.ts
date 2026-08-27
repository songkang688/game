/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "xiangqi",
  title: "鸭梨康康象棋",
  emoji: "🐘",
  category: "party" as const,
  color: "#F6DFC5",
  blurb: "188 课残局闯关，人机六档从小象学步打到星海棋神，还有残局连胜！",
  // endgames.ts 的 PUZZLES 正好 188 课残局(走 188 关框架);index.ts 另有
  // 自由对战(六档人机 + 鸭梨 VS 康康双人同屏)与残局连胜(写平台 endlessBest)
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  // 手机点交叉点、桌面点鼠标都好用:热区按 44px 反推,落子确认手机默认开
  platform: "both" as const,
};
