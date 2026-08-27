/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不 import 任何玩法代码,改动请同步 index.ts 里的实际内容。
 */
export const meta = {
  id: "prince-princess",
  title: "王子公主大冒险",
  emoji: "🤴",
  category: "action" as const,
  color: "#FFE3EF",
  blurb: "188 关双人横版!王子推重物、公主会滑翔,一张看图认路的元素表,每关都有小旗休息点,还能爬无尽城堡塔。",
  // index.ts 模式条:一个人玩 / 两人一起(共享心条) + 无尽「城堡塔」;战役走 188 关地图
  modes: ["campaign", "coop", "twoPlayer", "endless"] as const,
  levels: 188,
};
