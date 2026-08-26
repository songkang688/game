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
  blurb: "188 关双人横版!王子挥剑近战,公主放星星还会二段跳,共用一条心条,14 场首领战等你们。",
  // index.ts 模式条:一个人玩 / 两人一起(共享心条) + 无尽「王国远征」;战役走 188 关地图
  modes: ["campaign", "coop", "twoPlayer", "endless"] as const,
  levels: 188,
};
