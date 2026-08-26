/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不许 import 任何玩法代码,内容要和 index.ts / levels.ts 的实现保持一致。
 */
export const meta = {
  id: "gold-hook",
  title: "金矿钩钩",
  emoji: "⛏️",
  category: "action" as const,
  color: "#FFECD2",
  blurb: "钩子在矿洞顶来回摆,看准角度放绳!金块钻石宝箱都能钩,重的拉得慢,金币还能换炸药和力量水。",
  modes: ["campaign", "endless"] as const,
  levels: 188,
};
