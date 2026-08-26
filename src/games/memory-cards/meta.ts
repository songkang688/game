/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "memory-cards",
  title: "记忆翻翻乐",
  emoji: "🃏",
  category: "casual" as const,
  color: "#E3F2FF",
  blurb: "99 关六大主题！偷看、章鱼换牌、三连卡、限时赛，记忆小达人冲鸭！",
  // 10 章合计 188 关(blurb 里的「99」是 1.0 遗留文案,归 B 改),只有闯关
  modes: ["campaign"] as const,
  levels: 188,
};
