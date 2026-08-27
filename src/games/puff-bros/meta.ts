/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "puff-bros",
  title: "噗噗兄弟",
  emoji: "🫧",
  category: "party" as const,
  color: "#DDF1FF",
  blurb: "鸭梨和康康吹泡泡糖气流!三局两胜困住对手,或者携手闯 188 关合作关卡!",
  // index.ts 模式条:合作 188 关 / 双人对战 / 人机三档 / 无尽
  modes: ["campaign", "versus", "endless", "coop", "twoPlayer"] as const,
  levels: 188,
};
