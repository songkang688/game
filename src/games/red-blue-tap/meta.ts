/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "red-blue-tap",
  title: "红蓝点点",
  emoji: "🎈",
  category: "party" as const,
  color: "#4dabf7",
  blurb: "188 关抢点大战！双人同屏比谁更准，反应、顺序、颜色、计数四种回合轮着来。",
  // 10 章合计 188 关;闯关对手是小电脑(康康),另有同屏两人的「双人对战」与「点到手软」无尽
  modes: ["campaign", "versus", "endless"] as const,
  levels: 188,
};
