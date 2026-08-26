/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "candy-swing",
  title: "糖果秋千",
  emoji: "🍬",
  category: "action" as const,
  color: "#FFE0EE",
  blurb: "99 关 6 大主题！剪绳、传送、气球，把糖果送进啾啾嘴里！",
  // levels.ts 的 CHAPTER_SIZES 合计 99 关(自带存档,没走 188 关通用框架)
  modes: ["campaign"] as const,
  levels: 99,
};
