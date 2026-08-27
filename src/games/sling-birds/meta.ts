/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "sling-birds",
  title: "弹弹小鸟",
  emoji: "🐦",
  category: "action" as const,
  color: "#CFEBFF",
  blurb: "188 关 9 大世界!拉开大弹弓,看着预测点瞄准,把木冰石堡垒连锁拆塌;还有无尽打靶塔比谁拆得高!",
  // levels.ts 的 CHAPTER_SIZES 合计 188 关(自带存档);
  // 1.2 第 12 步 A 档补做无尽「打靶塔」(endless.ts + save.recordEndlessBest)。
  // 对战没做:同屏轮流打靶要么两人干等、要么各打各的,不如把弹道深度做透。
  modes: ["campaign", "endless"] as const,
  levels: 188,
  // 实测:鼠标拖拽与手指拖拽都用同一套「拖动锚点偏移」,360px 竖屏画布撑满舞台 → both。
  // 字段是 1.2 第 1 步 B 档给 GameMeta 加的可选项,缺省当 both,先填这里不影响老平台。
  platform: "both" as const
};
