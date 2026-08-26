/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "color-fun",
  title: "涂色小屋",
  emoji: "🎨",
  category: "create" as const,
  color: "#ffd43b",
  blurb: "十大村镇 188 关！指令涂色、调色锅、明暗渐变、互补配色、限色大挑战，还有一间随便涂的自由画室！",
  // 10 章合计 188 关,只有闯关一种玩法;自由涂色画室是关卡外的按钮,不算 mode
  modes: ["campaign"] as const,
  levels: 188,
  // 纯点击 + 双指缩放,手机与电脑都实测过
  platform: "both" as const,
};
