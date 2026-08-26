/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "garden-guard",
  title: "花园守卫",
  emoji: "🌼",
  category: "action" as const,
  color: "#ffd6e7",
  blurb: "188 关十三大主题塔防战役!七种塔各有克星,还能开无尽守到底!",
  // logic.ts 的 TOTAL_LEVELS = 188;1.2 补了无尽「守到底」(波次无限递增,记最高波数)
  // 对战不做:同屏两人抢着布塔会互相拆台,规则解释成本比玩法本身还高,不适合这个年龄段
  modes: ["campaign", "endless"] as const,
  levels: 188,
};
