/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "lianliankan",
  title: "连连看",
  emoji: "🔗",
  category: "casual" as const,
  color: "#FFEBDD",
  blurb: "99 关六大场馆！玩具会下落、鱼儿会游动，连连看新玩法！",
  // 10 章合计 188 关(blurb 里的「99」是 1.0 遗留文案,归 B 改),只有闯关
  modes: ["campaign"] as const,
  levels: 188,
};
