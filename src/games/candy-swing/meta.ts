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
  blurb: "188 关 10 大主题，外加无尽甜甜塔！剪绳、黏黏泡、弹簧蘑菇，一刀两断把糖送进啾啾嘴里！",
  // levels.ts 的 CHAPTER_SIZES 合计 188 关(自带存档)
  // 无尽「甜甜塔」在 endless.ts 现搭关卡,成绩走 save.recordEndlessBest("candy-swing", n)
  // 不做对战:割绳是「观察 → 规划 → 一次性下刀」的单人解谜,同屏两人划同一根绳,
  // 先下刀那个直接决定糖果轨迹,后手完全没有可操作空间;拆成两块画布又变成各玩各的,不是对战。
  modes: ["campaign", "endless"] as const,
  // 手指划线与鼠标拖拽完全等价,手游端游都能玩
  platform: "both" as const,
  levels: 188,
};
