/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "fruit-slice",
  title: "水果切切乐",
  emoji: "🍑",
  category: "action" as const,
  color: "#ffe0a3",
  blurb: "188 回合十二果园切果战役!彩虹连刀、双倍果、连体果,还有一波比一波密的无尽水果暴风!",
  // logic.ts 的 TOTAL_ROUNDS = 188;index.ts 另有禅宗、街机无尽与 1.2 的水果暴风(都算无尽玩法)
  modes: ["campaign", "endless"] as const,
  // 手指划刀最顺手;桌面按住鼠标拖也是同一套判定
  platform: "both" as const,
  levels: 188,
};
