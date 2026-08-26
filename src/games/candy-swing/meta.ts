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
  blurb: "188 关 10 大主题！剪绳、发条、磁铁、气流、粘性泡泡和弹簧蘑菇，把糖果送进啾啾嘴里；还有一颗接一颗的无尽甜甜塔。",
  // levels.ts 的 CHAPTER_SIZES 合计 188 关(自带存档);
  // 1.2 补了无尽「甜甜塔」,机关随颗数登场,成绩走 save.recordEndlessBest("candy-swing")。
  // 对战没做:划绳是「一个人静下心算轨迹」的玩法,同屏两个人只能轮流干等,做了也不好玩。
  // platform 字段等窗口 1 的平台模块合进来再补,这里不自造一套。
  modes: ["campaign", "endless"] as const,
  levels: 188,
};
