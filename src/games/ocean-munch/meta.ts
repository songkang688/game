/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "ocean-munch",
  title: "海底大胃王",
  emoji: "🐟",
  category: "action" as const,
  color: "#bfe9ff",
  blurb: "吃小鱼长大!188 关十二片海域战役,外加一直往下潜的深海马拉松和 60 秒比谁更胖的人机对战。",
  // index.ts 三个入口:188 关战役(logic.ts 的 TOTAL_LEVELS)/ 无尽深海马拉松 / 人机对战
  modes: ["campaign", "endless", "versus"] as const,
  levels: 188,
  // 手指跟着滑最顺,鼠标一样能玩;WASD / 方向键游动、空格冲刺(Esc 留给壳层)
  platform: "both" as const,
};
