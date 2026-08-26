/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "bubble-aim",
  title: "泡泡瞄准手",
  emoji: "🫧",
  category: "casual" as const,
  color: "#D9EFFF",
  blurb: "99 关 6 大主题世界：石泡、彩虹、黑洞、云挡板、泡泡雨，拖一拖瞄准线全爆掉！",
  // levels.ts 的 THEME_SIZES 合计 99 关(自带存档,没走 188 关通用框架)
  modes: ["campaign"] as const,
  levels: 99,
};
