/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "mole-pop",
  title: "地鼠嘭嘭",
  emoji: "🐹",
  category: "casual" as const,
  color: "#EBDFC8",
  blurb: "99 关六大乐园！金地鼠、瞌睡鼠、闪电鼠，还要保护小兔子！",
  // levels.ts 的 6 章合计 99 关(还没扩到 188),只有闯关
  modes: ["campaign"] as const,
  levels: 99,
};
