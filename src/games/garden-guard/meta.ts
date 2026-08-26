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
  blurb:
    "188 关十三大主题格子塔防!八种塔各有各的活儿,护甲迅捷飞行分裂四类怪各有克星;还有无尽「守到底」看你能撑到第几波。",
  // logic.ts 的 TOTAL_LEVELS = 188(前 99 关波次数据 1.2 未改动);
  // 1.2 第 13 步 A 档补做无尽「守到底」(endless.ts + save.recordEndlessBest)。
  // 对战没做:同屏塔防对抗要么两人抢同一片格子、要么各守各的互不干涉,
  // 前者会打架,后者只是两局单人游戏并排放;对这个年龄段来说规则也太绕,
  // 不如把「八座塔的克制关系」和「无尽越守越难」这两件事做扎实。
  modes: ["campaign", "endless"] as const,
  levels: 188,
  // 实测:放塔是「先点塔卡再点格子」的两段式,鼠标与手指同一套;
  // 360px 竖屏塔选择条横滑、图标 44px,HUD 一行不溢出 → both。
  platform: "both" as const,
};
